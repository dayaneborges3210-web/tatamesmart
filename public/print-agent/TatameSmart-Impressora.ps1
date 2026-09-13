# TatameSmart — agente RAW de impressora térmica (ESC/POS)
# Roda neste PC. O sistema manda o cupom; o agente joga RAW na impressora.
# Edite printer.json: { "host": "192.168.0.50", "port": 9100 }
# host vazio = usa a impressora padrão do Windows (Generic / Text Only).

$ErrorActionPreference = "Stop"
$Listen = "http://127.0.0.1:17891/"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$CfgPath = Join-Path $Here "printer.json"

function Load-Cfg {
  if (Test-Path $CfgPath) {
    return Get-Content $CfgPath -Raw | ConvertFrom-Json
  }
  $def = @{ host = ""; port = 9100; printerName = "" }
  ($def | ConvertTo-Json) | Set-Content -Encoding UTF8 $CfgPath
  return [pscustomobject]$def
}

function New-EscPos([string[]]$Lines, [bool]$Cut) {
  $bytes = New-Object System.Collections.Generic.List[byte]
  # ESC @ init
  [void]$bytes.Add(0x1B); [void]$bytes.Add(0x40)
  # ESC t 16 = WPC1252
  [void]$bytes.Add(0x1B); [void]$bytes.Add(0x74); [void]$bytes.Add(16)
  $enc = [System.Text.Encoding]::GetEncoding(1252)
  foreach ($line in $Lines) {
    $chunk = $enc.GetBytes(($line + "`n"))
    foreach ($b in $chunk) { [void]$bytes.Add($b) }
  }
  [void]$bytes.Add(0x0A); [void]$bytes.Add(0x0A)
  if ($Cut) {
    # GS V 0
    [void]$bytes.Add(0x1D); [void]$bytes.Add(0x56); [void]$bytes.Add(0x00)
  }
  return [byte[]]$bytes.ToArray()
}

function Send-Tcp([byte[]]$Raw, [string]$HostName, [int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.SendTimeout = 4000
  $client.ReceiveTimeout = 4000
  $client.Connect($HostName, $Port)
  $stream = $client.GetStream()
  $stream.Write($Raw, 0, $Raw.Length)
  $stream.Flush()
  $stream.Close()
  $client.Close()
}

function Send-WinPrinter([byte[]]$Raw, [string]$Name) {
  $tmp = Join-Path $env:TEMP ("tatamesmart-" + [guid]::NewGuid().ToString() + ".bin")
  [System.IO.File]::WriteAllBytes($tmp, $Raw)
  if ($Name) {
    $dest = "\\localhost\$Name"
  } else {
    $dest = "PRN"
  }
  cmd /c "copy /b `"$tmp`" `"$dest`"" | Out-Null
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

$cfg = Load-Cfg
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Listen)
$listener.Start()
Write-Host "TatameSmart impressora RAW em $Listen"
if ($cfg.host) { Write-Host "Destino TCP $($cfg.host):$($cfg.port)" } else { Write-Host "Destino: impressora do Windows" }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers.Add("Access-Control-Allow-Origin", "*")
  $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
  $res.Headers.Add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  try {
    if ($req.HttpMethod -eq "OPTIONS") {
      $res.StatusCode = 204
    } elseif ($req.Url.AbsolutePath -eq "/health") {
      $body = @{ ok = $true; printer = $(if ($cfg.host) { "$($cfg.host):$($cfg.port)" } else { "windows" }) } | ConvertTo-Json
      $buf = [Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentType = "application/json"
      $res.OutputStream.Write($buf, 0, $buf.Length)
    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.AbsolutePath -eq "/print") {
      $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $json = $reader.ReadToEnd() | ConvertFrom-Json
      $lines = @()
      if ($json.lines) { $lines = @($json.lines) } elseif ($json.text) { $lines = $json.text -split "`n" }
      $raw = New-EscPos $lines ([bool]$json.cut)
      $cfg = Load-Cfg
      if ($cfg.host) { Send-Tcp $raw $cfg.host ([int]$cfg.port) } else { Send-WinPrinter $raw ([string]$cfg.printerName) }
      $ok = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      $res.ContentType = "application/json"
      $res.OutputStream.Write($ok, 0, $ok.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch {
    $res.StatusCode = 500
    $err = [Text.Encoding]::UTF8.GetBytes(($_.Exception.Message))
    $res.OutputStream.Write($err, 0, $err.Length)
  } finally {
    $res.Close()
  }
}
