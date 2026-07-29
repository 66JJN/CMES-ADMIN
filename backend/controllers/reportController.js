/**
 * Report Controller — Business Logic สำหรับระบบแจ้งปัญหา
 */
import AdminReport from '../models/AdminReport.js';

// POST /api/report — รับ report จาก USER backend
export const createReport = async (req, res) => {
  try {
    // Route authentication supplies the tenant. Never accept it from payload.
    const shopId = req.shopId;
    const { category, detail } = req.body;

    console.log(`[Report] Received report: shopId="${shopId}", category="${category}"`);

    if (!category || !detail) {
      return res.status(400).json({ success: false, message: 'category and detail are required' });
    }

    const reportId = `RPT-${Date.now()}`;
    const newReport = await AdminReport.create({
      shopId, reportId, category,
      description: detail,
      status: 'new', priority: 'medium'
    });

    console.log(`[Report] ✓ New report saved: ${reportId} (shop: ${shopId}, _id: ${newReport._id})`);
    res.json({ success: true, reportId: newReport._id });
  } catch (err) {
    console.error('[Report] ✗ POST error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save report' });
  }
};

// GET /api/reports — ดึงรายการ report ทั้งหมด
export const getReports = async (req, res) => {
  try {
    const { shopId } = req;
    const reports = await AdminReport.find({ shopId }).sort({ createdAt: -1 }).lean();

    const mapped = reports.map(r => ({
      id: r._id.toString(),
      reportId: r.reportId,
      category: r.category,
      detail: r.description || '',
      status: r.status || 'new',
      priority: r.priority || 'medium',
      senderName: r.senderName || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    res.json(mapped);
  } catch (err) {
    console.error('[Report] GET error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

// PATCH /api/reports/:id — อัปเดตสถานะ report
export const updateReportStatus = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const updated = await AdminReport.findOneAndUpdate(
      { _id: id, shopId },
      { $set: { status } },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = {
      id: updated._id.toString(),
      reportId: updated.reportId,
      category: updated.category,
      detail: updated.description || '',
      status: updated.status,
      priority: updated.priority || 'medium',
      senderName: updated.senderName || '',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };

    console.log(`[Report] ✓ Status updated: ${id} → ${status}`);
    res.json({ success: true, report });
  } catch (err) {
    console.error('[Report] PATCH error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update report' });
  }
};
