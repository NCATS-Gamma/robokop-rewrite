import React from 'react';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import {
  render, fireEvent, waitFor, screen,
} from '&/test_utils';

import AlertContext from '~/context/alert';
import UserContext from '~/context/user';
import BiolinkContext from '~/context/biolink';

import biolink from '../common/biolink.json';
import QueryBuilder from '~/pages/queryBuilder/QueryBuilder';

const mockHistoryPush = jest.fn();

jest.mock('axios');
jest.mock('idb-keyval', () => ({
  set: jest.fn(() => Promise.resolve({})),
}));
// mocking url history: https://stackoverflow.com/a/59451956/8250415
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

function customRender(component) {
  return render(
    <MemoryRouter>
      <AlertContext.Provider value={jest.fn}>
        <UserContext.Provider value={{}}>
          <BiolinkContext.Provider value={biolink}>
            {component}
          </BiolinkContext.Provider>
        </UserContext.Provider>
      </AlertContext.Provider>
    </MemoryRouter>,
  );
}

describe('Full Workflow', () => {
  beforeEach(() => {
    // We have to override some svg functions: https://stackoverflow.com/a/66248540/8250415
    SVGElement.prototype.getComputedTextLength = () => 40;
  });
  it('asks a question', async () => {
    axios.mockResolvedValue({
      data: {
        message: {},
      },
    });
    customRender(<QueryBuilder />);
    fireEvent.click(screen.getByText('Quick Submit'));
    await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/answer'));
  });
});
