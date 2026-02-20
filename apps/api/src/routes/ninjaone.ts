// ─────────────────────────────────────────────────────────────
// NinjaOne Routes
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { NinjaOneClient } from '../clients/index.js';

const router: ExpressRouter = Router();

// Lazy client — only created when a request arrives; avoids startup crash if env vars are absent.
function getClient() {
  const clientId = process.env.NINJAONE_CLIENT_ID;
  const clientSecret = process.env.NINJAONE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new NinjaOneClient({
    clientId,
    clientSecret,
    ...(process.env.NINJAONE_BASE_URL ? { baseUrl: process.env.NINJAONE_BASE_URL } : {}),
  });
}

/**
 * GET /ninjaone/device/:id
 * Get device by ID (read-only)
 */
router.get('/device/:id', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const deviceId = req.params.id;
    const device = await client.getDevice(deviceId);
    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ninjaone/devices
 * List all devices (read-only)
 */
router.get('/devices', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const params: { limit?: number; after?: string } = {};
    if (req.query.limit) {
      params.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.after) {
      params.after = req.query.after as string;
    }
    const devices = await client.listDevices(params);
    res.json({
      success: true,
      data: devices,
      count: devices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ninjaone/organization/:organizationId/devices
 * List devices by organization (read-only)
 */
router.get('/organization/:organizationId/devices', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const organizationId = req.params.organizationId;
    const params: { limit?: number } = {};
    if (req.query.limit) {
      params.limit = parseInt(req.query.limit as string, 10);
    }
    const devices = await client.listDevicesByOrganization(organizationId, params);
    res.json({
      success: true,
      data: devices,
      count: devices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ninjaone/device/:id/checks
 * Get device health checks (read-only)
 */
router.get('/device/:id/checks', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const deviceId = req.params.id;
    const checks = await client.getDeviceChecks(deviceId);
    res.json({
      success: true,
      data: checks,
      count: checks.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ninjaone/device/:id/details
 * Get device details including custom fields (read-only)
 */
router.get('/device/:id/details', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const deviceId = req.params.id;
    const details = await client.getDeviceDetails(deviceId);
    res.json({
      success: true,
      data: details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
