// Mock for a storage system (for groups)
const mockGroupStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllItems: jest.fn(),
};

// Mock for Device objects (simplified)
interface MockDevice {
  id: string;
  name: string;
  type: string;
}

// Placeholder for actual GroupManager implementation
// Replace with actual import if GroupManager exists
// import { GroupManager } from '../../../../core/registry/group-manager';

interface Group {
  id: string;
  name: string;
  description?: string;
  deviceIds: Set<string>; // Using a Set to store unique device IDs
}

class GroupManager {
  private storage: typeof mockGroupStorage;

  constructor(storage: typeof mockGroupStorage) {
    this.storage = storage;
  }

  async createGroup(groupData: { id: string; name: string; description?: string }): Promise<Group> {
    if (!groupData || !groupData.id || !groupData.name) {
      throw new Error('Invalid group data: ID and name are required');
    }
    const existingGroup = await this.storage.getItem(groupData.id);
    if (existingGroup) {
      throw new Error('Group already exists');
    }
    const newGroup: Group = { ...groupData, deviceIds: new Set() };
    await this.storage.setItem(groupData.id, newGroup);
    return newGroup;
  }

  async getGroup(groupId: string): Promise<Group | null> {
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    return this.storage.getItem(groupId);
  }

  async deleteGroup(groupId: string): Promise<Group> {
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    const group = await this.storage.getItem(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    await this.storage.removeItem(groupId);
    return group;
  }

  async updateGroup(groupId: string, updates: { name?: string; description?: string }): Promise<Group> {
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    if (!updates || (updates.name === undefined && updates.description === undefined)) {
      throw new Error('No updates provided (name or description)');
    }
    const group = await this.storage.getItem(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    const updatedGroup = { ...group, ...updates, id: groupId };
    await this.storage.setItem(groupId, updatedGroup);
    return updatedGroup;
  }

  async addDeviceToGroup(groupId: string, deviceId: string): Promise<Group> {
    if (!groupId || !deviceId) {
      throw new Error('Group ID and Device ID are required');
    }
    const group = await this.storage.getItem(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    // In a real scenario, you might want to verify the device exists
    group.deviceIds.add(deviceId);
    await this.storage.setItem(groupId, group);
    return group;
  }

  async removeDeviceFromGroup(groupId: string, deviceId: string): Promise<Group> {
    if (!groupId || !deviceId) {
      throw new Error('Group ID and Device ID are required');
    }
    const group = await this.storage.getItem(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.deviceIds.has(deviceId)) {
      throw new Error('Device not in group');
    }
    group.deviceIds.delete(deviceId);
    await this.storage.setItem(groupId, group);
    return group;
  }

  async listDevicesInGroup(groupId: string): Promise<string[]> {
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    const group = await this.storage.getItem(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    return Array.from(group.deviceIds);
  }

  async listGroups(): Promise<Group[]> {
    const allItems = await this.storage.getAllItems();
    return Array.isArray(allItems) ? allItems : Object.values(allItems || {});
  }
}

describe('GroupManager', () => {
  let groupManager: GroupManager;

  beforeEach(() => {
    mockGroupStorage.getItem.mockReset();
    mockGroupStorage.setItem.mockReset();
    mockGroupStorage.removeItem.mockReset();
    mockGroupStorage.getAllItems.mockReset();
    groupManager = new GroupManager(mockGroupStorage);
  });

  describe('createGroup', () => {
    it('should create a new group successfully', async () => {
      const groupData = { id: 'group-1', name: 'Living Room Sensors', description: 'All sensors in the living room' };
      const expectedGroup: Group = { ...groupData, deviceIds: new Set() };
      mockGroupStorage.getItem.mockResolvedValue(null);
      mockGroupStorage.setItem.mockResolvedValue(undefined);

      const createdGroup = await groupManager.createGroup(groupData);

      expect(mockGroupStorage.getItem).toHaveBeenCalledWith('group-1');
      expect(mockGroupStorage.setItem).toHaveBeenCalledWith('group-1', expectedGroup);
      expect(createdGroup).toEqual(expectedGroup);
    });

    it('should throw an error if group data is invalid (missing id)', async () => {
      // @ts-expect-error testing invalid input
      await expect(groupManager.createGroup({ name: 'Test' })).rejects.toThrow('Invalid group data: ID and name are required');
    });

    it('should throw an error if group data is invalid (missing name)', async () => {
      // @ts-expect-error testing invalid input
      await expect(groupManager.createGroup({ id: 'g1' })).rejects.toThrow('Invalid group data: ID and name are required');
    });

    it('should throw an error if group already exists', async () => {
      const existingGroupData = { id: 'group-1', name: 'Living Room Sensors' };
      const existingGroup: Group = { ...existingGroupData, deviceIds: new Set() };
      mockGroupStorage.getItem.mockResolvedValue(existingGroup);

      await expect(groupManager.createGroup(existingGroupData)).rejects.toThrow('Group already exists');
    });
  });

  describe('getGroup', () => {
    it('should return a group if it exists', async () => {
      const group: Group = { id: 'group-1', name: 'Test Group', deviceIds: new Set(['d1']) };
      mockGroupStorage.getItem.mockResolvedValue(group);
      const foundGroup = await groupManager.getGroup('group-1');
      expect(mockGroupStorage.getItem).toHaveBeenCalledWith('group-1');
      expect(foundGroup).toEqual(group);
    });

    it('should return null if group does not exist', async () => {
      mockGroupStorage.getItem.mockResolvedValue(null);
      const foundGroup = await groupManager.getGroup('non-existent-group');
      expect(foundGroup).toBeNull();
    });

    it('should throw an error if group ID is not provided', async () => {
      // @ts-expect-error testing invalid input
      await expect(groupManager.getGroup(null)).rejects.toThrow('Group ID is required');
    });
  });

  describe('deleteGroup', () => {
    it('should delete an existing group successfully', async () => {
      const groupToDelete: Group = { id: 'group-1', name: 'Old Group', deviceIds: new Set() };
      mockGroupStorage.getItem.mockResolvedValue(groupToDelete);
      mockGroupStorage.removeItem.mockResolvedValue(undefined);

      const deletedGroup = await groupManager.deleteGroup('group-1');
      expect(mockGroupStorage.removeItem).toHaveBeenCalledWith('group-1');
      expect(deletedGroup).toEqual(groupToDelete);
    });

    it('should throw an error if group to delete is not found', async () => {
      mockGroupStorage.getItem.mockResolvedValue(null);
      await expect(groupManager.deleteGroup('non-existent-group')).rejects.toThrow('Group not found');
    });
  });

  describe('updateGroup', () => {
    it('should update group name and description', async () => {
      const originalGroup: Group = { id: 'group-1', name: 'Original Name', description: 'Original Desc', deviceIds: new Set() };
      const updates = { name: 'Updated Name', description: 'Updated Desc' };
      const expectedGroup: Group = { ...originalGroup, ...updates };
      mockGroupStorage.getItem.mockResolvedValue(originalGroup);
      mockGroupStorage.setItem.mockResolvedValue(undefined);

      const updatedGroup = await groupManager.updateGroup('group-1', updates);
      expect(mockGroupStorage.setItem).toHaveBeenCalledWith('group-1', expectedGroup);
      expect(updatedGroup).toEqual(expectedGroup);
    });

    it('should throw error if group not found for update', async () => {
        mockGroupStorage.getItem.mockResolvedValue(null);
        await expect(groupManager.updateGroup('non-existent', {name: 'new name'})).rejects.toThrow('Group not found');
    });

    it('should throw error if no updates provided', async () => {
        await expect(groupManager.updateGroup('group-1', {})).rejects.toThrow('No updates provided (name or description)');
    });
  });

  describe('addDeviceToGroup', () => {
    it('should add a device to an existing group', async () => {
      const group: Group = { id: 'group-1', name: 'Test Group', deviceIds: new Set() };
      mockGroupStorage.getItem.mockResolvedValue(group);
      mockGroupStorage.setItem.mockResolvedValue(undefined);

      const updatedGroup = await groupManager.addDeviceToGroup('group-1', 'device-123');
      expect(updatedGroup.deviceIds.has('device-123')).toBe(true);
      expect(mockGroupStorage.setItem).toHaveBeenCalledWith('group-1', group); // group object is mutated
    });

    it('should not add a duplicate device ID', async () => {
      const group: Group = { id: 'group-1', name: 'Test Group', deviceIds: new Set(['device-123']) };
      mockGroupStorage.getItem.mockResolvedValue(group);
      const updatedGroup = await groupManager.addDeviceToGroup('group-1', 'device-123');
      expect(updatedGroup.deviceIds.size).toBe(1);
    });

    it('should throw error if group not found when adding device', async () => {
        mockGroupStorage.getItem.mockResolvedValue(null);
        await expect(groupManager.addDeviceToGroup('non-existent', 'device-123')).rejects.toThrow('Group not found');
    });
  });

  describe('removeDeviceFromGroup', () => {
    it('should remove a device from an existing group', async () => {
      const group: Group = { id: 'group-1', name: 'Test Group', deviceIds: new Set(['device-123', 'device-456']) };
      mockGroupStorage.getItem.mockResolvedValue(group);
      mockGroupStorage.setItem.mockResolvedValue(undefined);

      const updatedGroup = await groupManager.removeDeviceFromGroup('group-1', 'device-123');
      expect(updatedGroup.deviceIds.has('device-123')).toBe(false);
      expect(updatedGroup.deviceIds.has('device-456')).toBe(true);
      expect(mockGroupStorage.setItem).toHaveBeenCalledWith('group-1', group);
    });

    it('should throw an error if device is not in the group', async () => {
      const group: Group = { id: 'group-1', name: 'Test Group', deviceIds: new Set(['device-456']) };
      mockGroupStorage.getItem.mockResolvedValue(group);
      await expect(groupManager.removeDeviceFromGroup('group-1', 'device-not-in-group')).rejects.toThrow('Device not in group');
    });

     it('should throw error if group not found when removing device', async () => {
        mockGroupStorage.getItem.mockResolvedValue(null);
        await expect(groupManager.removeDeviceFromGroup('non-existent', 'device-123')).rejects.toThrow('Group not found');
    });
  });

  describe('listDevicesInGroup', () => {
    it('should list all device IDs in a group', async () => {
      const deviceIds = ['d1', 'd2', 'd3'];
      const group: Group = { id: 'group-1', name: 'Test Group', deviceIds: new Set(deviceIds) };
      mockGroupStorage.getItem.mockResolvedValue(group);

      const listedIds = await groupManager.listDevicesInGroup('group-1');
      // Order might not be guaranteed with Set conversion, so check content and length
      expect(listedIds.length).toBe(deviceIds.length);
      deviceIds.forEach(id => expect(listedIds).toContain(id));
    });

    it('should return an empty array if group has no devices', async () => {
      const group: Group = { id: 'group-1', name: 'Empty Group', deviceIds: new Set() };
      mockGroupStorage.getItem.mockResolvedValue(group);
      const listedIds = await groupManager.listDevicesInGroup('group-1');
      expect(listedIds).toEqual([]);
    });

    it('should throw error if group not found for listing devices', async () => {
        mockGroupStorage.getItem.mockResolvedValue(null);
        await expect(groupManager.listDevicesInGroup('non-existent')).rejects.toThrow('Group not found');
    });
  });

  describe('listGroups', () => {
    it('should return a list of all groups', async () => {
      const groups: Group[] = [
        { id: 'g1', name: 'Group A', deviceIds: new Set(['d1']) },
        { id: 'g2', name: 'Group B', deviceIds: new Set(['d2', 'd3']) },
      ];
      mockGroupStorage.getAllItems.mockResolvedValue(groups);
      const groupList = await groupManager.listGroups();
      expect(mockGroupStorage.getAllItems).toHaveBeenCalled();
      expect(groupList).toEqual(groups);
    });

    it('should return an empty list if no groups exist', async () => {
      mockGroupStorage.getAllItems.mockResolvedValue([]);
      const groupList = await groupManager.listGroups();
      expect(groupList).toEqual([]);
    });
  });
});