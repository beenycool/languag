export const mockNetwork = {
  send: jest.fn(),
  reset: () => {
    mockNetwork.send.mockReset();
  }
};