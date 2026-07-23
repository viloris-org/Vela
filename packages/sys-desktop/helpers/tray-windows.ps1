# Vela tray helper (Windows): NotifyIcon + ContextMenuStrip, JSON-lines on stdio.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:trays = @{}
$script:outLock = New-Object object

function Emit($obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 8
  [System.Threading.Monitor]::Enter($script:outLock)
  try {
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  } finally {
    [System.Threading.Monitor]::Exit($script:outLock)
  }
}

function Build-Menu([string]$TrayId, $MenuSpec) {
  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  if ($null -eq $MenuSpec) { return $menu }
  foreach ($entry in $MenuSpec) {
    if ($entry.type -eq 'separator') {
      [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
      continue
    }
    $itemId = [string]$entry.id
    $label = [string]$entry.label
    $mi = New-Object System.Windows.Forms.ToolStripMenuItem($label)
    if ($entry.enabled -eq $false) { $mi.Enabled = $false }
    if ($entry.checked -eq $true) { $mi.Checked = $true }
    $mi.Tag = @{ trayId = $TrayId; itemId = $itemId }
    $mi.Add_Click({
      param($sender, $e)
      $tag = $sender.Tag
      Emit @{
        type = 'event'
        payload = @{
          id = [string]$tag.trayId
          action = 'menu'
          itemId = [string]$tag.itemId
        }
      }
    })
    [void]$menu.Items.Add($mi)
  }
  return $menu
}

function Ensure-Tray($Msg) {
  $trayId = [string]$Msg.trayId
  if ($script:trays.ContainsKey($trayId)) {
    $state = $script:trays[$trayId]
    $ni = $state.icon
    if ($null -ne $Msg.PSObject.Properties['tooltip'] -and $null -ne $Msg.tooltip) {
      $ni.Text = [string]$Msg.tooltip
    }
    if ($null -ne $Msg.PSObject.Properties['icon'] -and $null -ne $Msg.icon -and (Test-Path -LiteralPath ([string]$Msg.icon))) {
      $ni.Icon = New-Object System.Drawing.Icon([string]$Msg.icon)
    }
    if ($null -ne $Msg.PSObject.Properties['menu'] -and $null -ne $Msg.menu) {
      $ni.ContextMenuStrip = Build-Menu $trayId $Msg.menu
    }
    return
  }

  $ni = New-Object System.Windows.Forms.NotifyIcon
  $ni.Visible = $true
  $ni.Icon = [System.Drawing.SystemIcons]::Application
  if ($null -ne $Msg.tooltip) { $ni.Text = [string]$Msg.tooltip } else { $ni.Text = 'Vela' }
  if ($null -ne $Msg.icon -and (Test-Path -LiteralPath ([string]$Msg.icon))) {
    $ni.Icon = New-Object System.Drawing.Icon([string]$Msg.icon)
  }
  if ($null -ne $Msg.menu) {
    $ni.ContextMenuStrip = Build-Menu $trayId $Msg.menu
  }
  $ni.Tag = $trayId
  $ni.Add_MouseClick({
    param($sender, $e)
    $captured = [string]$sender.Tag
    $action = if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Right) { 'right-click' } else { 'click' }
    Emit @{
      type = 'event'
      payload = @{
        id = $captured
        action = $action
      }
    }
  })
  $script:trays[$trayId] = @{ icon = $ni }
}

function Handle-Req($Msg) {
  $reqId = $Msg.id
  $op = [string]$Msg.op
  try {
    switch ($op) {
      'create' {
        $trayId = [string]$Msg.trayId
        if ($script:trays.ContainsKey($trayId)) { throw "tray already exists: $trayId" }
        Ensure-Tray $Msg
        Emit @{ type = 'res'; id = $reqId; ok = $true; trayId = $trayId }
      }
      'update' {
        $trayId = [string]$Msg.trayId
        if (-not $script:trays.ContainsKey($trayId)) { throw "unknown tray: $trayId" }
        Ensure-Tray $Msg
        Emit @{ type = 'res'; id = $reqId; ok = $true }
      }
      'remove' {
        $trayId = [string]$Msg.trayId
        if (-not $script:trays.ContainsKey($trayId)) { throw "unknown tray: $trayId" }
        $state = $script:trays[$trayId]
        $state.icon.Visible = $false
        $state.icon.Dispose()
        $script:trays.Remove($trayId)
        Emit @{ type = 'res'; id = $reqId; ok = $true }
      }
      'quit' {
        Emit @{ type = 'res'; id = $reqId; ok = $true }
        [System.Windows.Forms.Application]::Exit()
      }
      default { throw "unknown op: $op" }
    }
  } catch {
    Emit @{ type = 'res'; id = $reqId; ok = $false; error = $_.Exception.Message }
  }
}

Emit @{ type = 'ready'; platform = 'windows'; pid = $PID }

$form = New-Object System.Windows.Forms.Form
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.FormBorderStyle = 'FixedToolWindow'
$form.Opacity = 0
$form.Show()
$form.Hide()

$thread = New-Object System.Threading.Thread -ArgumentList ([System.Threading.ParameterizedThreadStart]{
  param($UiForm)
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) {
      $UiForm.BeginInvoke([action]{ [System.Windows.Forms.Application]::Exit() }) | Out-Null
      break
    }
    $copy = $line.Trim()
    if ($copy.Length -eq 0) { continue }
    $UiForm.BeginInvoke([action]{
      try {
        $msg = $copy | ConvertFrom-Json
        if ($msg.type -eq 'req') { Handle-Req $msg }
      } catch {
        Emit @{ type = 'res'; id = $null; ok = $false; error = $_.Exception.Message }
      }
    }.GetNewClosure()) | Out-Null
  }
})
$thread.IsBackground = $true
$thread.SetApartmentState([System.Threading.ApartmentState]::MTA)
$thread.Start($form)

[System.Windows.Forms.Application]::Run()
