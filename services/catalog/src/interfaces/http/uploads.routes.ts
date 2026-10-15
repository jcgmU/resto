import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface UploadsRouterDeps {
  uploadDir?: string;
}

export function getUploadDir(customDir?: string): string {
  if (customDir) {
    return customDir;
  }
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  // En Docker linux suele existir /data/uploads o crearse
  if (fs.existsSync('/data/uploads')) {
    return '/data/uploads';
  }
  return path.resolve(process.cwd(), 'data/uploads');
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function getExtension(mimetype: string, originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  switch (mimetype) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

export function createUploadsRouter(deps?: UploadsRouterDeps): Router {
  const router = Router();
  const uploadDir = getUploadDir(deps?.uploadDir);

  // Asegurar que el directorio de uploads exista
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch {
    // Si no se puede crear al arranque, se intentará al subir
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = getExtension(file.mimetype, file.originalname);
      const uniqueName = `${crypto.randomUUID()}${ext}`;
      cb(null, uniqueName);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2 MB
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error('Tipo de archivo no permitido. Solo se permiten PNG, JPEG y WebP');
        (error as any).code = 'INVALID_MIME_TYPE';
        cb(error);
      }
    },
  });

  // POST /uploads - Protegido para ADMIN y MANAGER
  router.post(
    '/',
    (req: Request, res: Response, next: NextFunction) => {
      const role = (req.headers['x-user-role'] as string || '').toUpperCase();
      if (!role || (role !== 'ADMIN' && role !== 'MANAGER')) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Se requiere rol ADMIN o MANAGER para subir imágenes',
          },
        });
      }
      next();
    },
    (req: Request, res: Response) => {
      upload.any()(req, res, (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: {
                code: 'BAD_REQUEST',
                message: 'El archivo supera el límite de 2 MB',
              },
            });
          }
          if (err.code === 'INVALID_MIME_TYPE' || err.message?.includes('Tipo de archivo no permitido')) {
            return res.status(400).json({
              error: {
                code: 'BAD_REQUEST',
                message: 'Tipo de archivo no permitido. Solo se permiten PNG, JPEG y WebP',
              },
            });
          }
          return res.status(400).json({
            error: {
              code: 'BAD_REQUEST',
              message: err.message || 'Error al procesar el archivo',
            },
          });
        }

        const files = (req.files as Express.Multer.File[]) || [];
        const file = req.file || files[0];

        if (!file) {
          return res.status(400).json({
            error: {
              code: 'BAD_REQUEST',
              message: 'No se ha subido ningún archivo',
            },
          });
        }

        return res.status(201).json({
          url: `/uploads/${file.filename}`,
        });
      });
    }
  );

  // GET /uploads/:file - Endpoint público
  router.get('/:file', (req: Request, res: Response) => {
    const filename = path.basename(req.params.file);
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Archivo no encontrado',
        },
      });
    }

    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';

    res.setHeader('Content-Type', contentType);
    return res.sendFile(filePath);
  });

  return router;
}
