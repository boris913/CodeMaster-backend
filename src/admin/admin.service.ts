import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      completedEnrollments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { isPublished: true } }),
      this.prisma.enrollment.count(),
      this.prisma.enrollment.count({ where: { completed: true } }),
    ]);

    // Revenus (à implémenter si vous avez un système de paiement)
    // Pour l'exemple, on laisse à 0 ou on calcule via des données mockées
    const monthlyRevenue = 0; // À remplacer par vrai calcul

    return {
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      completedEnrollments,
      monthlyRevenue,
    };
  }
}
