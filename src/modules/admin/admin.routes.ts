import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { bibleAdminRouter } from '../bible/bible.routes.js';
import { mediaAdminRouter } from '../media/media.routes.js';
import { contentAdminRouter } from './content.routes.js';
import { sermonsAdminRouter } from './sermons.routes.js';
import { systemAdminRouter } from './system.routes.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use('/media', mediaAdminRouter);
adminRouter.use('/bible', bibleAdminRouter);
adminRouter.use(contentAdminRouter);
adminRouter.use(sermonsAdminRouter);
adminRouter.use(systemAdminRouter);
