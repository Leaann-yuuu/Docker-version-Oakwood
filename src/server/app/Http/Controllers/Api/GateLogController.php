<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GateLog;
use App\Services\GateService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GateLogController extends Controller
{
    public function loadGateLogs(Request $request)
    {
        $user = $request->user();
        $perPage = (int) $request->input('per_page', 10);
        if ($perPage <= 0 || $perPage > 100) {
            $perPage = 10;
        }

        $logs = GateLog::query()
            ->when($request->direction, fn ($q) => $q->where('direction', strtoupper($request->direction)))
            ->when($request->status, fn ($q) => $q->where('status', strtolower($request->status)))
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($inner) use ($search) {
                    $inner->where('plate_number', 'like', "%{$search}%")
                        ->orWhere('owner_name', 'like', "%{$search}%");
                });
            })
            ->when($user, function ($q) use ($user) {
                if ($user->isResident()) {
                    $q->where(function ($inner) use ($user) {
                        $inner->where('user_id', $user->user_id);
                        if (! empty($user->plate_number)) {
                            $normalizedPlate = strtoupper(preg_replace('/\s+/', '', $user->plate_number));
                            $inner->orWhereRaw('UPPER(REPLACE(plate_number, " ", "")) = ?', [$normalizedPlate]);
                        }
                    });
                }
            })
            ->when($request->period, function ($q) use ($request) {
                $period = $request->period;
                $start = match ($period) {
                    'today' => Carbon::today(),
                    'week' => Carbon::now()->startOfWeek(),
                    'month' => Carbon::now()->startOfMonth(),
                    'year' => Carbon::now()->startOfYear(),
                    default => null,
                };
                if ($start) {
                    $q->where('logged_at', '>=', $start);
                }
            })
            ->orderByDesc('logged_at')
            ->paginate($perPage);

        $logs->getCollection()->transform(fn ($log) => GateService::formatLog($log));

        return response()->json(['logs' => $logs], 200);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $statusSuffix = $request->status ? '_' . strtolower($request->status) : '';
        $filename = 'gate_logs' . $statusSuffix . '_' . now()->timezone('Asia/Manila')->format('Y-m-d_His') . '.csv';
        $user = $request->user();

        $query = GateLog::query()
            ->when($request->direction, fn ($q) => $q->where('direction', strtoupper($request->direction)))
            ->when($request->status, fn ($q) => $q->where('status', strtolower($request->status)))
            ->when($request->start_date, fn ($q) => $q->where('logged_at', '>=', Carbon::parse($request->start_date, 'Asia/Manila')->startOfDay()))
            ->when($request->end_date, fn ($q) => $q->where('logged_at', '<=', Carbon::parse($request->end_date, 'Asia/Manila')->endOfDay()))
            ->when($request->period, function ($q) use ($request) {
                $start = match ($request->period) {
                    'today', 'daily' => Carbon::today('Asia/Manila'),
                    'week', 'weekly' => Carbon::now('Asia/Manila')->startOfWeek(),
                    'month', 'monthly' => Carbon::now('Asia/Manila')->startOfMonth(),
                    'year', 'yearly' => Carbon::now('Asia/Manila')->startOfYear(),
                    default => null,
                };
                if ($start) {
                    $q->where('logged_at', '>=', $start);
                }
            })
            ->when($user, function ($q) use ($user) {
                if ($user->isResident()) {
                    $q->where(function ($inner) use ($user) {
                        $inner->where('user_id', $user->user_id);
                        if (! empty($user->plate_number)) {
                            $normalizedPlate = strtoupper(preg_replace('/\s+/', '', $user->plate_number));
                            $inner->orWhereRaw('UPPER(REPLACE(plate_number, " ", "")) = ?', [$normalizedPlate]);
                        }
                    });
                }
            })
            ->orderByDesc('logged_at');

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Plate Number', 'Owner Name', 'Car Model', 'Car Color', 'Direction', 'Status', 'Timestamp']);

            $query->chunk(200, function ($logs) use ($handle) {
                foreach ($logs as $log) {
                    $timestamp = $log->logged_at
                        ? Carbon::parse($log->logged_at)->timezone('Asia/Manila')->format('m/d/Y, h:i:s A')
                        : '—';

                    fputcsv($handle, [
                        $log->plate_number,
                        $log->owner_name ?? '—',
                        $log->car_model ?? '—',
                        $log->car_color ?? '—',
                        $log->direction === 'IN' ? 'Entry' : 'Exit',
                        ucfirst($log->status),
                        $timestamp,
                    ]);
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function exportPdf(Request $request)
    {
        $user = $request->user();
        $query = GateLog::query()
            ->when($request->direction, fn ($q) => $q->where('direction', strtoupper($request->direction)))
            ->when($request->status, fn ($q) => $q->where('status', strtolower($request->status)))
            ->when($request->start_date, fn ($q) => $q->where('logged_at', '>=', Carbon::parse($request->start_date, 'Asia/Manila')->startOfDay()))
            ->when($request->end_date, fn ($q) => $q->where('logged_at', '<=', Carbon::parse($request->end_date, 'Asia/Manila')->endOfDay()))
            ->when($request->period, function ($q) use ($request) {
                $start = match ($request->period) {
                    'today', 'daily' => Carbon::today('Asia/Manila'),
                    'week', 'weekly' => Carbon::now('Asia/Manila')->startOfWeek(),
                    'month', 'monthly' => Carbon::now('Asia/Manila')->startOfMonth(),
                    'year', 'yearly' => Carbon::now('Asia/Manila')->startOfYear(),
                    default => null,
                };
                if ($start) {
                    $q->where('logged_at', '>=', $start);
                }
            })
            ->when($user, function ($q) use ($user) {
                if ($user->isResident()) {
                    $q->where(function ($inner) use ($user) {
                        $inner->where('user_id', $user->user_id);
                        if (! empty($user->plate_number)) {
                            $normalizedPlate = strtoupper(preg_replace('/\s+/', '', $user->plate_number));
                            $inner->orWhereRaw('UPPER(REPLACE(plate_number, " ", "")) = ?', [$normalizedPlate]);
                        }
                    });
                }
            })
            ->orderByDesc('logged_at')
            ->limit(1000);

        $logs = $query->get();

        $filterSummary = [];
        if ($request->status) {
            $filterSummary[] = 'Status: ' . ucfirst($request->status);
        }
        if ($request->start_date || $request->end_date) {
            $filterSummary[] = 'Range: ' . ($request->start_date ?? 'Any') . ' to ' . ($request->end_date ?? 'Now');
        } elseif ($request->period) {
            $filterSummary[] = 'Period: ' . ucfirst($request->period);
        }

        $html = view('exports.gate_logs_pdf', [
            'logs' => $logs,
            'generatedAt' => now()->timezone('Asia/Manila'),
            'filterSummary' => implode(' | ', $filterSummary),
        ])->render();

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="gate_logs_report.html"',
        ]);
    }
}

