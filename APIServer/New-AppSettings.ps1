function New-RandomKey {
    -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
}

if (-not (Test-Path appsettings.json)) {

    $json = (Get-Content .\appsettings-template.json | ConvertFrom-Json)

    $json.PwdMan.TokenConfig.SignKey = New-RandomKey
    $json.PwdMan.TokenConfig.LongLivedSignKey = New-RandomKey
    $json.PwdMan.TokenConfig.Issuer = "localhost"
    $json.PwdMan.TokenConfig.Audience = "localhost"

    $json.PwdMan.FamilyAccessToken = New-RandomKey

    $json.Appointment.SignKey = New-RandomKey
        
    ConvertTo-Json $json -Depth 10 | Out-File appsettings.json -Encoding utf8    
}
