type Role = 'admin' | 'developer' | 'viewer';
type Policy = {
  resource: string;
  actions: string[];
};

export class IdentityManager {
  private users = new Map<string, string>(); // username -> hashedPassword
  private roles = new Map<string, Role>();
  private policies = new Map<string, Policy[]>();

  authenticate(username: string, password: string) {
    const storedHash = this.users.get(username);
    return storedHash === this.hashPassword(password);
  }

  createUser(username: string, password: string, role: Role) {
    if (this.users.has(username)) throw new Error('User exists');
    this.users.set(username, this.hashPassword(password));
    this.roles.set(username, role);
  }

  assignPolicy(username: string, policy: Policy) {
    const userPolicies = this.policies.get(username) || [];
    userPolicies.push(policy);
    this.policies.set(username, userPolicies);
  }

  authorize(username: string, resource: string, action: string) {
    const role = this.roles.get(username);
    const policies = this.policies.get(username) || [];
    
    return policies.some(p => 
      p.resource === resource && 
      p.actions.includes(action)
    ) || this.getRolePermissions(role).includes(action);
  }

  private getRolePermissions(role?: Role) {
    switch(role) {
      case 'admin': return ['*'];
      case 'developer': return ['read', 'write'];
      case 'viewer': return ['read'];
      default: return [];
    }
  }

  private hashPassword(pwd: string) {
    // Simplified for example - use proper hashing in production
    return Buffer.from(pwd).toString('base64');
  }
}