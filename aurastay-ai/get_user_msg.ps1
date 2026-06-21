$logPath = "C:\Users\user\.gemini\antigravity\brain\78d29bd6-fd0a-4e11-b312-73a79109cadc\.system_generated\logs\transcript.jsonl"
$outputPath = "C:\Users\user\.gemini\antigravity\scratch\aurastay-ai\last_user_message_full.txt"

$fileStream = New-Object System.IO.FileStream($logPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$streamReader = New-Object System.IO.StreamReader($fileStream, [System.Text.Encoding]::UTF8)
$lastContent = ""
while (($line = $streamReader.ReadLine()) -ne $null) {
    if ($line -like '*"type":"USER_INPUT"*') {
        $lastContent = $line
    }
}
$streamReader.Close()
$fileStream.Close()

$lastContent | Out-File -FilePath $outputPath -Encoding UTF8
Write-Output "DONE_EXTRACT"
