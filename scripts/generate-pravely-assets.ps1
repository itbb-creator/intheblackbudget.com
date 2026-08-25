param(
  [Parameter(Mandatory = $true)][string]$HorizontalSource,
  [Parameter(Mandatory = $true)][string]$StackedSource,
  [Parameter(Mandatory = $true)][string]$IconSource
)

Add-Type -AssemblyName System.Drawing

function Get-ContentBounds([System.Drawing.Bitmap]$image, [scriptblock]$isContent) {
  $minX = $image.Width
  $minY = $image.Height
  $maxX = -1
  $maxY = -1
  for ($y = 0; $y -lt $image.Height; $y++) {
    for ($x = 0; $x -lt $image.Width; $x++) {
      if (& $isContent $image.GetPixel($x, $y)) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  return [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
}

function Export-DarkLogo([string]$source, [string]$destination) {
  $input = [System.Drawing.Bitmap]::FromFile($source)
  $bounds = Get-ContentBounds $input { param($c) (($c.R + $c.G + $c.B) / 3) -lt 205 }
  $padding = 18
  $output = New-Object System.Drawing.Bitmap ($bounds.Width + 2 * $padding), ($bounds.Height + 2 * $padding), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $bounds.Height; $y++) {
    for ($x = 0; $x -lt $bounds.Width; $x++) {
      $color = $input.GetPixel($bounds.X + $x, $bounds.Y + $y)
      $luminance = ($color.R + $color.G + $color.B) / 3
      $alpha = if ($luminance -ge 242) { 0 } elseif ($luminance -le 210) { 255 } else { [int](255 * (242 - $luminance) / 32) }
      $output.SetPixel($x + $padding, $y + $padding, [System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B))
    }
  }
  $output.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  $output.Dispose()
  $input.Dispose()
}

function Export-AppIcon([string]$source, [string]$destination) {
  $input = [System.Drawing.Bitmap]::FromFile($source)
  $bounds = Get-ContentBounds $input { param($c) $c.G -lt 205 -or $c.R -lt 205 -or $c.B -lt 205 }
  $size = [Math]::Min($bounds.Width, $bounds.Height)
  $sourceX = $bounds.X + [int](($bounds.Width - $size) / 2)
  $sourceY = $bounds.Y + [int](($bounds.Height - $size) / 2)
  $radius = [int]($size * 0.16)
  $output = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
      $cornerX = if ($x -lt $radius) { $radius - $x } elseif ($x -ge ($size - $radius)) { $x - ($size - $radius - 1) } else { 0 }
      $cornerY = if ($y -lt $radius) { $radius - $y } elseif ($y -ge ($size - $radius)) { $y - ($size - $radius - 1) } else { 0 }
      $inside = $cornerX -eq 0 -or $cornerY -eq 0 -or (($cornerX * $cornerX + $cornerY * $cornerY) -le ($radius * $radius))
      $color = $input.GetPixel($sourceX + $x, $sourceY + $y)
      $alpha = if ($inside) { 255 } else { 0 }
      $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B))
    }
  }
  $output.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  $output.Dispose()
  $input.Dispose()
}

function Export-Resized([string]$source, [string]$destination, [int]$width, [int]$height) {
  $input = [System.Drawing.Bitmap]::FromFile($source)
  $output = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($output)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.DrawImage($input, 0, 0, $width, $height)
  $output.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $output.Dispose()
  $input.Dispose()
}

function Export-SocialCard([string]$iconSource, [string]$destination) {
  $output = New-Object System.Drawing.Bitmap 1200, 630, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($output)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#0a0f0d'))
  $icon = [System.Drawing.Bitmap]::FromFile($iconSource)
  $graphics.DrawImage($icon, 72, 58, 92, 92)
  $brandFont = New-Object System.Drawing.Font 'Arial', 30, ([System.Drawing.FontStyle]::Bold)
  $headlineFont = New-Object System.Drawing.Font 'Arial', 53, ([System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font 'Arial', 23, ([System.Drawing.FontStyle]::Regular)
  $monoFont = New-Object System.Drawing.Font 'Consolas', 18, ([System.Drawing.FontStyle]::Regular)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#b7c0bc'))
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#20a06b'))
  $graphics.DrawString('PRAVELY', $brandFont, $white, 184, 82)
  $graphics.DrawString('One spreadsheet.', $headlineFont, $white, 72, 212)
  $graphics.DrawString('One payment.', $headlineFont, $white, 72, 278)
  $graphics.DrawString('A budget that tells you where you stand —', $bodyFont, $muted, 76, 378)
  $graphics.DrawString('no subscription, no app, no bank login.', $bodyFont, $muted, 76, 416)
  $graphics.FillRectangle($green, 72, 520, 256, 3)
  $graphics.DrawString('PRIVATE  •  PRACTICAL  •  YOURS', $monoFont, $green, 72, 544)
  $output.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  $green.Dispose(); $muted.Dispose(); $white.Dispose()
  $monoFont.Dispose(); $bodyFont.Dispose(); $headlineFont.Dispose(); $brandFont.Dispose()
  $icon.Dispose(); $graphics.Dispose(); $output.Dispose()
}

$imageDirectory = Join-Path $PSScriptRoot '..\images'
Export-DarkLogo $HorizontalSource (Join-Path $imageDirectory 'pravely-logo-horizontal.png')
Export-DarkLogo $StackedSource (Join-Path $imageDirectory 'pravely-logo-stacked.png')
Export-AppIcon $IconSource (Join-Path $imageDirectory 'pravely-app-icon.png')
Copy-Item -LiteralPath (Join-Path $imageDirectory 'pravely-app-icon.png') -Destination (Join-Path $imageDirectory 'logo.png') -Force
Copy-Item -LiteralPath (Join-Path $imageDirectory 'pravely-logo-horizontal.png') -Destination (Join-Path $imageDirectory 'logo-lockup.png') -Force
Export-Resized (Join-Path $imageDirectory 'pravely-app-icon.png') (Join-Path $imageDirectory 'apple-touch-icon.png') 180 180
Export-Resized (Join-Path $imageDirectory 'pravely-app-icon.png') (Join-Path $imageDirectory 'favicon-32.png') 32 32
Export-Resized (Join-Path $imageDirectory 'pravely-app-icon.png') (Join-Path $PSScriptRoot '..\favicon.png') 64 64
Export-SocialCard (Join-Path $imageDirectory 'pravely-app-icon.png') (Join-Path $imageDirectory 'og-image.png')
