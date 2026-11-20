<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemStatus extends Model
{
    protected $table = 'tbl_system_status';

    protected $primaryKey = 'system_status_id';

    protected $fillable = [
        'gate_status',
        'camera_status',
        'entrance_camera_status',
        'exit_camera_status',
        'sensor_status',
        'camera_stream_url',
        'entrance_camera_stream_url',
        'exit_camera_stream_url',
    ];

    public static function current(): self
    {
        $defaultEntrance = env('ESP32_CAM_ENTRANCE_STREAM_URL') ?: env('ESP32_CAM_STREAM_URL') ?: 'rtsp://Cameraentrance:Cameraentrance@192.168.254.200:554/stream1';
        $defaultExit = env('ESP32_CAM_EXIT_STREAM_URL') ?: 'rtsp://Capstonecameraexit:Capstonecameraexit@192.168.254.122:554/stream1';

        $status = static::query()->firstOrCreate([], [
            'gate_status' => 'closed',
            'camera_status' => 'offline',
            'entrance_camera_status' => 'offline',
            'exit_camera_status' => 'offline',
            'sensor_status' => 'online',
            'camera_stream_url' => $defaultEntrance,
            'entrance_camera_stream_url' => $defaultEntrance,
            'exit_camera_stream_url' => $defaultExit,
        ]);

        // Sync with .env changes if they differ
        if ($status->camera_stream_url !== $defaultEntrance || $status->entrance_camera_stream_url !== $defaultEntrance || $status->exit_camera_stream_url !== $defaultExit) {
            $status->update([
                'camera_stream_url' => $defaultEntrance,
                'entrance_camera_stream_url' => $defaultEntrance,
                'exit_camera_stream_url' => $defaultExit,
            ]);
        }

        return $status;
    }

    public function checkHealth(): void
    {
        $entranceStatus = $this->checkLocalSnapshotFreshness('camera_entrance.jpg');
        $exitStatus = $this->checkLocalSnapshotFreshness('camera_exit.jpg');

        $recentlyChecked = $this->updated_at && abs(now()->diffInSeconds($this->updated_at)) < 15;

        if ($entranceStatus === null) {
            if ($recentlyChecked && $this->entrance_camera_status) {
                $entranceStatus = $this->entrance_camera_status;
            } else {
                $entranceUrl = $this->entrance_camera_stream_url ?: $this->camera_stream_url ?: env('ESP32_CAM_ENTRANCE_STREAM_URL') ?: env('ESP32_CAM_STREAM_URL') ?: 'http://192.168.2.100:81/stream';
                $entranceStatus = $this->pingUrl($entranceUrl);
            }
        }

        if ($exitStatus === null) {
            if ($recentlyChecked && $this->exit_camera_status) {
                $exitStatus = $this->exit_camera_status;
            } else {
                $exitUrl = $this->exit_camera_stream_url ?: env('ESP32_CAM_EXIT_STREAM_URL') ?: 'http://192.168.2.105:81/stream';
                $exitStatus = $this->pingUrl($exitUrl);
            }
        }

        if (
            $this->entrance_camera_status !== $entranceStatus ||
            $this->exit_camera_status !== $exitStatus ||
            $this->camera_status !== $entranceStatus
        ) {
            $this->update([
                'entrance_camera_status' => $entranceStatus,
                'exit_camera_status' => $exitStatus,
                'camera_status' => $entranceStatus,
            ]);
        }
    }

    private function checkLocalSnapshotFreshness(string $filename): ?string
    {
        $localPath = public_path($filename);
        if (file_exists($localPath)) {
            clearstatcache(true, $localPath);
            $mtime = @filemtime($localPath);
            if ($mtime && (time() - $mtime) < 15) {
                return 'online';
            }
        }

        return null;
    }

    private function pingUrl(?string $url): string
    {
        if (! $url) {
            return 'offline';
        }

        $parts = parse_url($url);
        $host = $parts['host'] ?? null;
        $scheme = $parts['scheme'] ?? 'http';
        $port = $parts['port'] ?? ($scheme === 'rtsp' ? 554 : 80);

        if (! $host) {
            return 'offline';
        }

        $connection = @fsockopen($host, $port, $errno, $errstr, 0.25);

        if (is_resource($connection)) {
            fclose($connection);
            return 'online';
        }

        return 'offline';
    }

    public static function getActivePlateInfo(string $direction): ?array
    {
        $log = \App\Models\GateLog::whereIn('direction', [strtolower($direction), strtoupper($direction)])
            ->orderBy('gate_log_id', 'desc')
            ->first();

        $timestamp = $log?->created_at ?? $log?->logged_at;
        if ($log && $timestamp && abs(now()->diffInSeconds($timestamp)) < 15) {
            $isAuthorized = in_array(strtolower($log->status), ['authorized', 'granted']);
            return [
                'plate_number' => $log->plate_number,
                'status' => $isAuthorized ? 'verified' : 'error',
                'authorized' => $isAuthorized,
                'resident_name' => $log->owner_name ?? ($log->resident ? ($log->resident->first_name . ' ' . $log->resident->last_name) : null),
                'car_model' => $log->car_model,
                'car_color' => $log->car_color,
            ];
        }

        return null;
    }
}
