/**
 * Copyright (c) 2017-present, Wonday (@wonday.org)
 * All rights reserved.
 *
 * This source code is licensed under the MIT-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {
    View,
    StyleSheet,
    PanResponder
} from 'react-native';
import {ViewPropTypes} from 'deprecated-react-native-prop-types';
export default class PinchZoomView extends Component {

    static propTypes = {
        ...ViewPropTypes,
        scalable: PropTypes.bool,
        onScaleChanged: PropTypes.func,
    };

    static defaultProps = {
        scalable: true,
        onScaleChanged: (scale) => {
        },
    };

    constructor(props) {

        super(props);
        this.state = {};
        this.distant = 0;
        this.gestureHandlers = PanResponder.create({
            onStartShouldSetPanResponder: this._handleStartShouldSetPanResponder,
            onMoveShouldSetResponderCapture: this._handleMoveShouldSetResponderCapture,
            onMoveShouldSetPanResponder: this._handleMoveShouldSetPanResponder,
            onPanResponderGrant: this._handlePanResponderGrant,
            onPanResponderMove: this._handlePanResponderMove,
            onPanResponderRelease: this._handlePanResponderEnd,
            onPanResponderTerminationRequest: evt => false,
            onPanResponderTerminate: this._handlePanResponderTerminate,
            onShouldBlockNativeResponder: evt => true
        });

    }

    _handleStartShouldSetPanResponder = (e, gestureState) => {

        // don't respond to single touch to avoid shielding click on child components
        return false;

    };

    _getPinchTouches = (e) => {
        const touches = e?.nativeEvent?.touches;
        if (!Array.isArray(touches) || touches.length < 2) {
            return null;
        }
        const firstTouch = touches[0];
        const secondTouch = touches[1];
        if (!firstTouch || !secondTouch) {
            return null;
        }
        if (typeof firstTouch.pageX !== 'number' || typeof firstTouch.pageY !== 'number'
            || typeof secondTouch.pageX !== 'number' || typeof secondTouch.pageY !== 'number') {
            return null;
        }
        return [firstTouch, secondTouch];
    };


    _handleMoveShouldSetResponderCapture = (e, gestureState) => {

        return this.props.scalable && this._getPinchTouches(e) !== null;

    };

    _handleMoveShouldSetPanResponder = (e, gestureState) => {

        return this.props.scalable
            && (this._getPinchTouches(e) !== null || (gestureState && gestureState.numberActiveTouches >= 2));

    };

    _handlePanResponderGrant = (e, gestureState) => {

        const pinchTouches = this._getPinchTouches(e);
        if (!pinchTouches) {
            this.distant = 0;
            return;
        }

        let dx = Math.abs(pinchTouches[0].pageX - pinchTouches[1].pageX);
        let dy = Math.abs(pinchTouches[0].pageY - pinchTouches[1].pageY);
        this.distant = Math.sqrt(dx * dx + dy * dy);

    };

    _handlePanResponderEnd = (e, gestureState) => {

        this.distant = 0;

    };

    _handlePanResponderTerminate = (e, gestureState) => {

        this.distant = 0;

    };

    _handlePanResponderMove = (e, gestureState) => {

        const pinchTouches = this._getPinchTouches(e);
        if (!pinchTouches) {
            this.distant = 0;
            return;
        }

        let dx = Math.abs(pinchTouches[0].pageX - pinchTouches[1].pageX);
        let dy = Math.abs(pinchTouches[0].pageY - pinchTouches[1].pageY);
        let distant = Math.sqrt(dx * dx + dy * dy);

        if (this.distant <= 0) {
            this.distant = distant;
            return;
        }

        if (this.distant > 100) {
            let scale = (distant / this.distant);
            let pageX = (pinchTouches[0].pageX + pinchTouches[1].pageX) / 2;
            let pageY = (pinchTouches[0].pageY + pinchTouches[1].pageY) / 2;
            let pinchInfo = {scale: scale, pageX: pageX, pageY: pageY};

            this.props.onScaleChanged(pinchInfo);
        }

        this.distant = distant;

    };

    render() {

        return (
            <View
                {...this.props}
                {...this.gestureHandlers?.panHandlers}
                style={[styles.container, this.props.style]}>
                {this.props.children}
            </View>
        );

    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
