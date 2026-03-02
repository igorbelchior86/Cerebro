// ─────────────────────────────────────────────────────────────
// IT Glue Routes
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { ITGlueClient } from '../../clients/index.js';

const router: ExpressRouter = Router();

// Lazy client — only created when a request arrives; avoids startup crash if env vars are absent.
function getClient() {
  const apiKey = process.env.ITGLUE_API_KEY;
  if (!apiKey) return null;
  return new ITGlueClient({
    apiKey,
    ...(process.env.ITGLUE_BASE_URL ? { baseUrl: process.env.ITGLUE_BASE_URL } : {}),
  });
}

/**
 * GET /itglue/documents/search
 * Search documents by name (read-only)
 */
router.get('/documents/search', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const query = req.query.q as string;
    const organizationId = req.query.org as string | undefined;
    if (!query) {
      res.status(400).json({ error: 'q (query) parameter is required' });
      return;
    }
    const documents = await client.searchDocuments(query, organizationId);
    res.json({
      success: true,
      data: documents,
      count: documents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itglue/document/:id
 * Get document by ID (read-only)
 */
router.get('/document/:id', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const documentId = req.params.id;
    const document = await client.getDocument(documentId);
    res.json({
      success: true,
      data: document,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itglue/organization/:organizationId/documents
 * Get documents for an organization (read-only)
 */
router.get('/organization/:organizationId/documents', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const organizationId = req.params.organizationId;
    const documents = await client.getOrganizationDocuments(organizationId);
    res.json({
      success: true,
      data: documents,
      count: documents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itglue/documents/by-type
 * Get documents by type (e.g., 'Runbooks') (read-only)
 */
router.get('/documents/by-type', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const documentType = req.query.type as string;
    if (!documentType) {
      res.status(400).json({ error: 'type query parameter is required' });
      return;
    }
    const documents = await client.getDocumentsByType(documentType);
    res.json({
      success: true,
      data: documents,
      count: documents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itglue/runbooks
 * Get all runbooks (read-only)
 */
router.get('/runbooks', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const organizationId = req.query.org as string | undefined;
    const runbooks = await client.getRunbooks(organizationId);
    res.json({
      success: true,
      data: runbooks,
      count: runbooks.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itglue/flexible-asset-types
 * Get all flexible asset types (read-only)
 */
router.get('/flexible-asset-types', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const types = await client.getFlexibleAssetTypes();
    res.json({
      success: true,
      data: types,
      count: types.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itglue/flexible-assets/:assetTypeId
 * Get flexible assets (read-only)
 */
router.get('/flexible-assets/:assetTypeId', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const assetTypeId = req.params.assetTypeId;
    const organizationId = req.query.org as string | undefined;
    const assets = await client.getFlexibleAssets(assetTypeId, organizationId);
    res.json({
      success: true,
      data: assets,
      count: assets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
