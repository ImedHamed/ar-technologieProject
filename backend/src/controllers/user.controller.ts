import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthService } from '../services/auth.service';

export class UserController {
    /**
     * List all users (admin only)
     * GET /api/v1/users
     */
    static async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    roleId: true,
                    isActive: true,
                    canEdit: true,
                    allowedSecteurs: true,
                    lastLogin: true,
                    createdAt: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            res.json({ users });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    /**
     * Update user permissions (admin only)
     * PUT /api/v1/users/:id/permissions
     */
    static async updatePermissions(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id as string;
            const { canEdit, allowedSecteurs } = req.body;

            // Check user exists
            const existingUser = await prisma.user.findUnique({ where: { id } });
            if (!existingUser) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            const updateData: any = {};
            if (typeof canEdit === 'boolean') {
                updateData.canEdit = canEdit;
            }
            if (Array.isArray(allowedSecteurs)) {
                updateData.allowedSecteurs = allowedSecteurs;
            }

            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    roleId: true,
                    isActive: true,
                    canEdit: true,
                    allowedSecteurs: true,
                    lastLogin: true,
                    createdAt: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                        },
                    },
                },
            });

            res.json({ user });
        } catch (error) {
            console.error('Error updating permissions:', error);
            res.status(500).json({ error: 'Failed to update permissions' });
        }
    }

    /**
     * List roles (excluding Admin)
     * GET /api/v1/users/roles
     */
    static async getRoles(_req: Request, res: Response): Promise<void> {
        try {
            const roles = await prisma.role.findMany({
                select: {
                    id: true,
                    name: true,
                    description: true,
                },
                orderBy: { name: 'asc' },
            });
            res.json({ roles });
        } catch (error) {
            console.error('Error fetching roles:', error);
            res.status(500).json({ error: 'Failed to fetch roles' });
        }
    }

    /**
     * Create a new user (admin only)
     * POST /api/v1/users
     */
    static async createUser(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, firstName, lastName, roleId } = req.body;

            if (!email || !password || !firstName || !lastName || !roleId) {
                res.status(400).json({ error: 'Tous les champs sont obligatoires' });
                return;
            }

            // Check if email already exists
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà' });
                return;
            }

            // Verify role exists and is not Admin
            const role = await prisma.role.findUnique({ where: { id: roleId } });
            if (!role) {
                res.status(400).json({ error: 'Rôle invalide' });
                return;
            }

            const passwordHash = await AuthService.hashPassword(password);

            const user = await prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName,
                    lastName,
                    roleId,
                    isActive: true,
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    roleId: true,
                    isActive: true,
                    canEdit: true,
                    allowedSecteurs: true,
                    lastLogin: true,
                    createdAt: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                        },
                    },
                },
            });

            res.status(201).json({ user });
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    }

    /**
     * Delete a user (admin only)
     * DELETE /api/v1/users/:id
     */
    static async deleteUser(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id as string;
            const currentUserId = (req as any).userId;

            // Prevent self-deletion
            if (id === currentUserId) {
                res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
                return;
            }

            const user = await prisma.user.findUnique({
                where: { id },
                include: { role: true },
            });

            if (!user) {
                res.status(404).json({ error: 'Utilisateur non trouvé' });
                return;
            }

            // Prevent deleting other admins
            if (user.role.name === 'Admin') {
                res.status(403).json({ error: 'Impossible de supprimer un administrateur' });
                return;
            }

            await prisma.user.delete({ where: { id } });

            res.json({ message: 'Utilisateur supprimé avec succès' });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    }
}
