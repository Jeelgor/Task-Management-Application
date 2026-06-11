import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  createTask, 
  getTasks, 
  getTaskById, 
  updateTask, 
  deleteTask, 
  streamTasks, 
  getAllAdminTasks, 
  uploadAttachment 
} from '../controllers/task.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTaskSchema, updateTaskSchema, taskQuerySchema } from '../schemas/task.schema';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Only allow images and PDFs for example
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed!'));
    }
  }
});

const router = Router();

router.use(authenticate);

router.get('/stream', streamTasks);
router.get('/admin', requireAdmin, validate(taskQuerySchema), getAllAdminTasks);

router.post('/', validate(createTaskSchema), createTask);
router.get('/', validate(taskQuerySchema), getTasks);
router.get('/:id', getTaskById);
router.patch('/:id', validate(updateTaskSchema), updateTask);
router.delete('/:id', deleteTask);

router.post('/:id/attachments', upload.single('file'), uploadAttachment);

export default router;
