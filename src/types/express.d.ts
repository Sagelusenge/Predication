declare global {
  namespace Express {
    interface AuthPrincipal {
      userId: string;
      sessionId: string;
      email: string;
      firstName: string;
      lastName: string;
      roles: string[];
      permissions: string[];
    }

    interface Request {
      auth?: AuthPrincipal;
    }
  }
}

export {};
