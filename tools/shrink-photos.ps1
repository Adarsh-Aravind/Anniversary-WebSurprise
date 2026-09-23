# Resizes every photo in private/photos to at most 1400px on the long side (JPEG, quality 82).
# Originals are moved to private/photos/originals first, so nothing is lost.
#
#   powershell -ExecutionPolicy Bypass -File tools/shrink-photos.ps1

Add-Type -AssemblyName System.Drawing

$maxSide = 1400
$quality = 82
$photos = Join-Path $PSScriptRoot "..\private\photos"
$originals = Join-Path $photos "originals"
New-Item -ItemType Directory -Force $originals | Out-Null

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)

Get-ChildItem $photos -File | Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | ForEach-Object {
    $backup = Join-Path $originals $_.Name
    if (-not (Test-Path $backup)) { Copy-Item $_.FullName $backup }

    $img = [System.Drawing.Image]::FromFile($backup)
    # Respect the phone's rotation flag (EXIF 0x0112) so photos aren't sideways.
    if ($img.PropertyIdList -contains 0x0112) {
        switch ($img.GetPropertyItem(0x0112).Value[0]) {
            3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
            6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
            8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
        }
    }
    $scale = [Math]::Min([double]1, [double]$maxSide / [Math]::Max($img.Width, $img.Height))
    $w = [int]([Math]::Round($img.Width * $scale)); $h = [int]([Math]::Round($img.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $img.Dispose(); $g.Dispose()

    # Always saved as .jpg with the same base name; content.js should reference .jpg names.
    # Written to a temp file first so a failed save never leaves a broken photo.
    $target = [System.IO.Path]::ChangeExtension($_.FullName, ".jpg")
    $temp = "$target.tmp"
    $bmp.Save($temp, $codec, $params)
    $bmp.Dispose()
    if ($_.Extension -ne ".jpg") { Remove-Item $_.FullName }
    Move-Item -Force $temp $target
    Write-Host ("  {0}  ->  {1}x{2}, {3:N0} KB" -f $_.Name, $w, $h, ((Get-Item $target).Length / 1KB))
}
Write-Host "Done. Originals kept in private/photos/originals."
