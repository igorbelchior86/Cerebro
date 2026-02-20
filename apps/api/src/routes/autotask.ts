// ─────────────────────────────────────────────────────────────
// Autotask Routes
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { AutotaskClient } from '../clients/index.js';

const router: ExpressRouter = Router();

// Lazy client — only created when a request arrives; avoids startup crash if env vars are absent.
function getClient() {
  const code = process.env.AUTOTASK_API_INTEGRATION_CODE;
  const user = process.env.AUTOTASK_USERNAME;
  const secret = process.env.AUTOTASK_SECRET;
  if (!code || !user || !secret) return null;
  return new AutotaskClient({
    apiIntegrationCode: code,
    username: user,
    secret,
    ...(process.env.AUTOTASK_ZONE_URL ? { zoneUrl: process.env.AUTOTASK_ZONE_URL } : {}),
  });
}

/**
 * GET /autotask/ticket/:id
 * Get ticket by ID (read-only)
 */
router.get('/ticket/:id', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const ticketId = parseInt(req.params.id, 10);
    const ticket = await client.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/tickets/search
 * Search tickets (read-only)
 */
router.get('/tickets/search', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const filter = req.query.filter as string;
    if (!filter) {
      res.status(400).json({ error: 'filter query parameter is required' });
      return;
    }
    const tickets = await client.searchTickets(filter);
    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/device/:id
 * Get device by ID (read-only)
 */
router.get('/device/:id', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const deviceId = parseInt(req.params.id, 10);
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
 * GET /autotask/company/:companyId/devices
 * Get all devices for a company (read-only)
 */
router.get('/company/:companyId/devices', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const companyId = parseInt(req.params.companyId, 10);
    const devices = await client.getDevicesByCompany(companyId);
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
 * GET /autotask/ticket/:id/notes
 * Get ticket notes (read-only)
 */
router.get('/ticket/:id/notes', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const ticketId = parseInt(req.params.id, 10);
    const notes = await client.getTicketNotes(ticketId);
    res.json({
      success: true,
      data: notes,
      count: notes.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
