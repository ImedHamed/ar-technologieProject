import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/users/roles
 * @desc    List available roles (non-admin) — public for registration
 * @access  Public
 */
router.get('/roles', UserController.getRoles);

/**
 * @route   GET /api/v1/users
 * @desc    List all users (admin only)
 * @access  Private (Admin)
 */
router.get('/', authenticate, UserController.getAll);

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user (admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, UserController.createUser);

/**
 * @route   PUT /api/v1/users/:id/permissions
 * @desc    Update user permissions
 * @access  Private (Admin)
 */
router.put('/:id/permissions', authenticate, UserController.updatePermissions);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete a user (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, UserController.deleteUser);

export default router;
