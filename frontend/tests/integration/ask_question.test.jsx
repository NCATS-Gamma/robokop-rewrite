import React from 'react';
import mockAxios from '&/axios';
import {
  render, fireEvent, waitFor, within, screen,
} from '&/test_utils';
import biolink from '&/biolink_model.json';
import test_message from '&/test_message.json';

import App from '~/App';

// needed for web worker import
jest.mock('~/pages/answer/fullKg/simulation.worker.js');
// https://jestjs.io/docs/timer-mocks#run-pending-timers
jest.useFakeTimers();
jest.mock('idb-keyval', () => {
  const saved_message = require('&/test_message.json');
  return {
    set: jest.fn()
      .mockImplementationOnce(() => Promise.resolve()),
    get: jest.fn()
      .mockImplementation(() => Promise.resolve(JSON.stringify(saved_message))),
  };
});

describe('Full question workflow', () => {
  beforeEach(() => {
    // We have to override some svg functions: https://stackoverflow.com/a/66248540/8250415
    SVGElement.prototype.getComputedTextLength = () => 40;
    window.open = () => ({
      document: {
        write: jest.fn(),
      },
    });
  });
  it('successfully asks a question', async () => {
    // biolink model response
    mockAxios.mockResponse(biolink);
    render(<App />);
    // wait for initial api calls
    await screen.findByText('Question Builder');
    fireEvent.click(screen.getByText('Question Builder'));

    // update n0
    const n0 = screen.getAllByRole('combobox')[0];
    const n0Input = within(n0).getByRole('textbox');
    n0.focus();
    mockAxios.mockNameResolver('MONDO:0005737');
    mockAxios.mockNodeNorm('Ebola Hemorrhaggic Fever', ['biolink:Disease']);
    await waitFor(() => fireEvent.change(n0Input, { target: { value: 'Ebola' } }));
    await waitFor(() => screen.findByText('Loading…'));
    jest.runOnlyPendingTimers();
    await waitFor(() => fireEvent.keyDown(n0, { key: 'Enter' }));

    // update n1
    const n1 = screen.getAllByRole('combobox')[2];
    const n1Input = within(n1).getByRole('textbox');
    n1.focus();
    mockAxios.mockNameResolver('NCBIGene:4864');
    mockAxios.mockNodeNorm('NPC1', ['biolink:Gene']);
    await waitFor(() => fireEvent.change(n1Input, { target: { value: 'NPC1' } }));
    await waitFor(() => screen.findByText('Loading…'));
    jest.runOnlyPendingTimers();
    await waitFor(() => fireEvent.keyDown(n1, { key: 'Enter' }));

    // submit question
    mockAxios.mockResponse({ data: test_message });
    await waitFor(() => fireEvent.click(screen.getByText('Quick Submit')));

    // answer page loaded, check that things showed up
    expect(await screen.queryByRole('cell', { name: 'Ebola Hemorrhagic Fever' })).toBeTruthy();
    expect(await screen.queryByRole('cell', { name: 'NPC1' })).toBeTruthy();
  });
});
