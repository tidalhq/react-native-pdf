/** @format */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import App from '../PDFExample';

const mockSetPage = jest.fn();
jest.mock('react-native-pdf', () => {
  const ReactMock = require('react');
  return ReactMock.forwardRef((props: object, ref: unknown) => {
    ReactMock.useImperativeHandle(ref, () => ({setPage: mockSetPage}));
    return ReactMock.createElement('Pdf', props);
  });
});
jest.mock('../test.pdf', () => 1);
jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');
  return {SafeAreaProvider: View, SafeAreaView: View};
});

let app: ReactTestRenderer.ReactTestRenderer;
beforeEach(async () => {
  mockSetPage.mockClear();
  await act(() => { app = ReactTestRenderer.create(<App />); });
});
afterEach(async () => { await act(() => app.unmount()); });
const pdf = () => app.root.findByType('Pdf' as React.ElementType);
const press = async (label: string) => {
  await act(() => app.root.findAllByProps({accessibilityLabel: label})[0].props.onPress());
};

test('imperative buttons never mask navigation with a controlled page update', async () => {
  expect(pdf().props.renderPageOverlay).toBeDefined();
  await press('Page 2');
  expect(mockSetPage).toHaveBeenLastCalledWith(2);
  expect(pdf().props.page).toBe(1);
  await act(() => pdf().props.onPageChanged(2));
  expect(pdf().props.page).toBe(1);
  await press('Controlled 2');
  expect(pdf().props.page).toBe(2);
});

test('native, legacy, and custom wrapper scenarios select distinct props', async () => {
  await press('native');
  expect(pdf().props.renderPageOverlay).toBeUndefined();
  expect(pdf().props.usePDFKit).toBe(true);
  await press('legacy');
  expect(pdf().props.usePDFKit).toBe(false);
  await press('wrapper');
  expect(pdf().props.renderPageOverlay).toBeDefined();
  expect(pdf().props.customFlatListWrapper).toBeDefined();
});

test('on-load and hidden scenarios request pages from the load callback only', async () => {
  await press('on-load');
  expect(mockSetPage).not.toHaveBeenCalled();
  await act(() => pdf().props.onLoadComplete(21));
  expect(mockSetPage).toHaveBeenLastCalledWith(2);
  expect(pdf().props.page).toBe(1);
  await press('hidden');
  await act(() => pdf().props.onLoadComplete(21));
  expect(mockSetPage).toHaveBeenLastCalledWith(3);
  expect(pdf().props.page).toBe(1);
  expect(app.root.findAllByProps({accessibilityLabel: 'Show'}).length).toBeGreaterThan(0);
});
