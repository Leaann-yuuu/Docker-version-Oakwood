<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Gate Logs Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.meta { color: #555; font-size: 12px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f3f4f6; }
        .badge-auth { color: #166534; font-weight: bold; }
        .badge-unauth { color: #991b1b; font-weight: bold; }
        .filter-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; margin-left: 6px; }
        .tag-unauth { background: #fee2e2; color: #991b1b; }
        .tag-auth { background: #dcfce7; color: #166534; }
        .tag-all { background: #f3f4f6; color: #374151; }
    </style>
</head>
<body>
    <h1>Gate Access Logs Report</h1>
    <p class="meta">
        Generated: {{ \Illuminate\Support\Carbon::parse($generatedAt)->timezone('Asia/Manila')->format('F j, Y g:i A') }} &mdash; {{ $logs->count() }} records
        @if (!empty($filterSummary))
            &bull; <span class="filter-tag {{ str_contains(strtolower($filterSummary), 'unauthorized') ? 'tag-unauth' : (str_contains(strtolower($filterSummary), 'authorized') ? 'tag-auth' : 'tag-all') }}">{{ $filterSummary }}</span>
        @endif
    </p>
    <table>
        <thead>
            <tr>
                <th>Plate Number</th>
                <th>Owner Name</th>
                <th>Car Model</th>
                <th>Car Color</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Timestamp</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($logs as $log)
            <tr>
                <td style="font-family: monospace; font-weight: bold;">{{ $log->plate_number }}</td>
                <td>{{ $log->owner_name ?? '—' }}</td>
                <td>{{ $log->car_model ?? '—' }}</td>
                <td>{{ $log->car_color ?? '—' }}</td>
                <td>{{ $log->direction === 'IN' ? 'Entry' : 'Exit' }}</td>
                <td class="{{ $log->status === 'authorized' ? 'badge-auth' : 'badge-unauth' }}">{{ ucfirst($log->status) }}</td>
                <td style="white-space: nowrap;">{{ $log->logged_at ? \Illuminate\Support\Carbon::parse($log->logged_at)->timezone('Asia/Manila')->format('m/d/Y, h:i:s A') : '—' }}</td>
            </tr>
            @empty
            <tr><td colspan="7" style="text-align: center; color: #777; padding: 24px;">No logs found for the selected criteria.</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
