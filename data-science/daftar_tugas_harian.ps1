# Mendaftarkan tarik_harian.py ke Windows Task Scheduler (laptop).
# Jalankan sekali: powershell -ExecutionPolicy Bypass -File data-science\daftar_tugas_harian.ps1
# Hapus lagi:      Unregister-ScheduledTask -TaskName "KebunIbu-TarikHarian" -Confirm:$false

$dasar = $PSScriptRoot
$aksi = New-ScheduledTaskAction `
    -Execute (Join-Path $dasar ".venv\Scripts\pythonw.exe") `
    -Argument ('"' + (Join-Path $dasar "tarik_harian.py") + '"') `
    -WorkingDirectory $dasar

# 06:00 tarikan utama; 12:00 hanya mengulang sumber yang pagi tadi gagal (yang sukses dilewati).
$pemicu = @(
    New-ScheduledTaskTrigger -Daily -At "06:00"
    New-ScheduledTaskTrigger -Daily -At "12:00"
)

$aturan = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName "KebunIbu-TarikHarian" `
    -Description "Tarik harga buah Blibli + Tokopedia (data-science/tarik_harian.py)" `
    -Action $aksi -Trigger $pemicu -Settings $aturan -Force
