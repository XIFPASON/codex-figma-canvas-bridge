Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择 Figma 设计数据的保存文件夹'
$dialog.ShowNewFolderButton = $true
try {
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        # ASCII output avoids console encoding differences for Chinese paths.
        $encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath))
        [Console]::Out.Write($encoded)
    }
} finally {
    $dialog.Dispose()
}
