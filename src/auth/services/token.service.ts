import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { randomBytes } from 'crypto';
import { Token } from '../../entities/token.entity';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
  ) {}

  /**
   * Generate a secure random token (256 characters long)
   */
  generateToken(): string {
    // Generate 128 bytes = 256 hex characters for longer tokens
    return randomBytes(128).toString('hex');
  }

  /**
   * Create access token
   */
  async createAccessToken(userId: number): Promise<string> {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    await this.tokenRepository.save({
      userId,
      token,
      tokenType: 'access',
      expiresAt,
    });

    return token;
  }

  /**
   * Create refresh token
   */
  async createRefreshToken(userId: number): Promise<string> {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await this.tokenRepository.save({
      userId,
      token,
      tokenType: 'refresh',
      expiresAt,
    });

    return token;
  }

  /**
   * Validate and get token
   */
  async validateToken(token: string, tokenType: 'access' | 'refresh'): Promise<Token | null> {
    const tokenRecord = await this.tokenRepository.findOne({
      where: {
        token,
        tokenType,
      },
      relations: ['user'],
    });

    if (!tokenRecord) {
      return null;
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      // Delete expired token
      await this.tokenRepository.delete({ id: tokenRecord.id });
      return null;
    }

    return tokenRecord;
  }

  /**
   * Delete token
   */
  async deleteToken(token: string): Promise<void> {
    await this.tokenRepository.delete({ token });
  }

  /**
   * Delete all tokens for a user
   */
  async deleteUserTokens(userId: number): Promise<void> {
    await this.tokenRepository.delete({ userId });
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    await this.tokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}

