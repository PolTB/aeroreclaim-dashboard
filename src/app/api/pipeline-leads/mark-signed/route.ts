import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '10zEyvd3P57DidwOi2UM1VnXHDnPrIWMnpTSbdZ4zX-E';
const API_KEY  = process.env.GOOGLE_SHEETS_API_KEY ?? '';

export async function POST(request: Request) {
  try {
    const { caseId } = await request.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    console.log(`[mark-signed] Marking ${caseId} as signed`);

    if (!API_KEY) {
      // Mock mode: log and return success
      console.log('[mark-signed] No API key — mock success for', caseId);
      return NextResponse.json({ ok: true, caseId, mock: true });
    }

    // Find the row in Onboarding_Queue
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;
    const res  = await fetch(`${base}/Onboarding_Queue!A:Z?key=${API_KEY}`);
    if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`);

    const data  = await res.json();
    const rows: string[][] = data.values ?? [];
    if (rows.length < 2) return NextResponse.json({ error: 'No data in Onboarding_Queue' }, { status: 404 });

    const hdr   = rows[0].map((h: string) => h.trim().toLowerCase());
    const colId = hdr.indexOf('case_id');
    const colSig = hdr.indexOf('mandate_signed');
    const colSt  = hdr.indexOf('status');

    if (colId < 0) return NextResponse.json({ error: 'case_id column not found' }, { status: 500 });

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colId] ?? '').trim() === caseId) { targetRow = i + 1; break; }
    }
    if (targetRow < 0) return NextResponse.json({ error: `Case ${caseId} not found` }, { status: 404 });

    // Write mandate_signed=TRUE and status=FIRMADO via batchUpdate
    // Note: Sheets API with API key is read-only for public sheets.
    // Writes require OAuth. Log the intent and return success for now.
    // When OAuth is configured, replace with proper write call.
    console.log(`[mark-signed] Would write mandate_signed=TRUE to row ${targetRow} for ${caseId}`);
    console.log(`[mark-signed] cols — id:${colId} sig:${colSig} status:${colSt}`);

    // TODO: Replace with OAuth-authenticated write when service account is configured
    // For now: return success and Pol updates the Sheet manually based on the log
    return NextResponse.json({
      ok: true,
      caseId,
      targetRow,
      note: 'Logged — manual Sheet update needed until OAuth write is configured',
    });

  } catch (err) {
    console.error('[mark-signed]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
