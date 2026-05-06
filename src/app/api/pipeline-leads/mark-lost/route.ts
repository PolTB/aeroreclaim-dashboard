import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '10zEyvd3P57DidwOi2UM1VnXHDnPrIWMnpTSbdZ4zX-E';
const API_KEY  = process.env.GOOGLE_SHEETS_API_KEY ?? '';

export async function POST(request: Request) {
  try {
    const { caseId, reason } = await request.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    console.log(`[mark-lost] Marking ${caseId} as PERDIDO — reason: ${reason ?? 'no reason'}`);

    if (!API_KEY) {
      return NextResponse.json({ ok: true, caseId, reason, mock: true });
    }

    const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;
    const res  = await fetch(`${base}/Onboarding_Queue!A:Z?key=${API_KEY}`);
    if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`);

    const data  = await res.json();
    const rows: string[][] = data.values ?? [];
    const hdr   = rows[0]?.map((h: string) => h.trim().toLowerCase()) ?? [];
    const colId = hdr.indexOf('case_id');

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colId] ?? '').trim() === caseId) { targetRow = i + 1; break; }
    }

    console.log(`[mark-lost] Would write PERDIDO to row ${targetRow} for ${caseId}. Reason: ${reason}`);
    // TODO: OAuth write when service account configured

    return NextResponse.json({ ok: true, caseId, reason, targetRow,
      note: 'Logged — manual Sheet update needed until OAuth write is configured' });

  } catch (err) {
    console.error('[mark-lost]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
