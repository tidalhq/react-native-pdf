/**
 * @flow
 * @format
 */
'use strict';

import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export type NativeProps = $ReadOnly<{|
  ...ViewProps,
  fileNo: ?Int32,
  page: ?Int32,
  enableAnnotationRendering: ?boolean,
|}>;

export default codegenNativeComponent<NativeProps>('RNPDFPdfPageView', {
  excludedPlatforms: ['android'],
});
