/**
 * Copyright (c) 2017-present, Wonday (@wonday.org)
 * Licensed under the MIT license in the root LICENSE file.
 */
import React, {useRef, useState} from 'react';
import {FlatList, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import Pdf, {type PdfProps, type PdfRef} from 'react-native-pdf';

// A bundled fixture avoids depending on third-party PDF servers during QA.
const source = Platform.OS === 'windows'
  ? {uri: 'ms-appx:///test.pdf'}
  : require('./test.pdf');
const scenarios = ['overlay', 'native', 'wrapper', 'legacy', 'single', 'on-load', 'hidden'] as const;
type Scenario = typeof scenarios[number];

function Button({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} testID={label}
      onPress={onPress} style={styles.button}>
      <Text>{label}</Text>
    </Pressable>
  );
}

const overlay: PdfProps['renderPageOverlay'] = ({page}) => (
  <View pointerEvents="none" style={styles.overlay}>
    <Text style={styles.overlayLabel}>Overlay page {page}</Text>
  </View>
);
const customWrapper: PdfProps['customFlatListWrapper'] = props => <FlatList {...props} />;

function ScenarioViewer({scenario}: {scenario: Scenario}) {
  const pdf = useRef<PdfRef>(null);
  const [observedPage, setObservedPage] = useState(0);
  const [controlledPage, setControlledPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [request, setRequest] = useState('none');
  const [error, setError] = useState('none');
  const [visible, setVisible] = useState(scenario !== 'hidden');
  const [mounted, setMounted] = useState(true);
  const [horizontal, setHorizontal] = useState(false);
  const [scale, setScale] = useState(1);
  const [annotations, setAnnotations] = useState(true);
  const hasOverlay = scenario !== 'native' && scenario !== 'legacy';

  const navigate = (page: number) => {
    setRequest(`setPage(${page})`);
    // Deliberately do NOT update controlledPage: it would mask #21358.
    pdf.current?.setPage(page);
  };

  return (
    <View style={styles.viewer}>
      <Text testID="Status" accessibilityLiveRegion="polite">
        {`Scenario: ${scenario} | page: ${observedPage}/${pages} | prop: ${controlledPage}`}
      </Text>
      <Text testID="Request">{`Request: ${request}`}</Text>
      <Text testID="Error">{`Error: ${error}`}</Text>
      <View style={styles.row}>
        <Button label="Page 1" onPress={() => navigate(1)} />
        <Button label="Page 2" onPress={() => navigate(2)} />
        <Button label="Page 3" onPress={() => navigate(3)} />
        <Button label="Controlled 2" onPress={() => setControlledPage(2)} />
      </View>
      <View style={styles.row}>
        <Button label="Zoom" onPress={() => setScale(value => value === 1 ? 1.5 : 1)} />
        <Button label="Direction" onPress={() => setHorizontal(value => !value)} />
        <Button label={visible ? 'Hide' : 'Show'} onPress={() => setVisible(value => !value)} />
        <Button label={mounted ? 'Unmount' : 'Mount'} onPress={() => {
          setMounted(value => !value); setObservedPage(0); setPages(0);
        }} />
        <Button label="Annotations" onPress={() => setAnnotations(value => !value)} />
      </View>
      <Text>{`Scale: ${scale.toFixed(1)} | horizontal: ${horizontal} | annotations: ${annotations}`}</Text>
      {mounted && (
        <View style={visible ? styles.pdfContainer : styles.hiddenContainer}>
          <Pdf
            ref={pdf}
            source={source}
            trustAllCerts={false}
            page={controlledPage}
            scale={scale}
            horizontal={horizontal}
            singlePage={scenario === 'single'}
            enableAnnotationRendering={annotations}
            renderPageOverlay={hasOverlay ? overlay : undefined}
            customFlatListWrapper={scenario === 'wrapper' ? customWrapper : undefined}
            {...{usePDFKit: scenario !== 'legacy'}}
            onLoadComplete={(count: number) => {
              setPages(count);
              if (scenario === 'on-load') navigate(2);
              if (scenario === 'hidden') navigate(3);
            }}
            onPageChanged={(page: number) => setObservedPage(page)}
            onScaleChanged={(value: number) => setScale(value)}
            onError={(value: unknown) => setError(String(value))}
            style={styles.pdf}
          />
        </View>
      )}
    </View>
  );
}

export default function PDFExample() {
  const [scenario, setScenario] = useState<Scenario>('overlay');
  const [revision, setRevision] = useState(0);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <Text style={styles.title}>PDF renderer regression lab</Text>
        <View style={styles.row}>
          {scenarios.map(value => (
            <Button key={value} label={value} onPress={() => {
              setScenario(value); setRevision(current => current + 1);
            }} />
          ))}
        </View>
        <ScenarioViewer key={`${scenario}-${revision}`} scenario={scenario} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#fff'},
  title: {fontSize: 18, fontWeight: '600', padding: 8},
  viewer: {flex: 1},
  row: {flexDirection: 'row', flexWrap: 'wrap'},
  button: {backgroundColor: '#d5eefc', padding: 8, margin: 3, borderRadius: 4},
  pdfContainer: {flex: 1, overflow: 'hidden'},
  hiddenContainer: {width: 0, height: 0, overflow: 'hidden'},
  pdf: {flex: 1},
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, borderWidth: 2, borderColor: '#c00'},
  overlayLabel: {color: '#900', backgroundColor: '#ffe6e6', alignSelf: 'flex-start'},
});
