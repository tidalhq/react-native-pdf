/**
 * Copyright (c) 2017-present, Wonday (@wonday.org)
 * All rights reserved.
 *
 * This source code is licensed under the MIT-style license found in the
 * LICENSE file in the root directory of this source tree.
 */



#import "PdfManager.h"
#import <PDFKit/PDFKit.h>

#if __has_include(<React/RCTAssert.h>)
#import <React/RCTUtils.h>
#else
#import "React/RCTUtils.h"
#endif


static NSMutableArray *pdfDocRefs = Nil;
static NSMutableArray *pdfDocuments = Nil;

@implementation PdfManager


#ifndef __OPTIMIZE__
// only output log when debug
#define DLog( s, ... ) NSLog( @"<%p %@:(%d)> %@", self, [[NSString stringWithUTF8String:__FILE__] lastPathComponent], __LINE__, [NSString stringWithFormat:(s), ##__VA_ARGS__] )
#else
#define DLog( s, ... )
#endif

// output log both debug and release
#define RLog( s, ... ) NSLog( @"<%p %@:(%d)> %@", self, [[NSString stringWithUTF8String:__FILE__] lastPathComponent], __LINE__, [NSString stringWithFormat:(s), ##__VA_ARGS__] )

RCT_EXPORT_MODULE();


RCT_EXPORT_METHOD(loadFile:(NSString *)path
                  password:(NSString *)password
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
                  )
{

    if (pdfDocRefs==Nil) {
        pdfDocRefs = [NSMutableArray arrayWithCapacity:1];
    }
    if (pdfDocuments==Nil) {
        pdfDocuments = [NSMutableArray arrayWithCapacity:1];
    }

    int numberOfPages = 0;

    if (path != nil && path.length != 0) {

        NSString *decodedPath = (__bridge_transfer NSString *)CFURLCreateStringByReplacingPercentEscapes(NULL, (CFStringRef)path, CFSTR(""));
        
        NSString *finalPath = NULL;
        if (decodedPath == NULL) {
            // use orignal provided path
            finalPath = path;
        } else {
            finalPath = decodedPath;
        }
        
        NSURL *pdfURL = [NSURL fileURLWithPath:finalPath];
        CGPDFDocumentRef pdfRef = CGPDFDocumentCreateWithURL((__bridge CFURLRef) pdfURL);
        PDFDocument *pdfDocument = [[PDFDocument alloc] initWithURL:pdfURL];

        if (pdfRef == NULL) {
            reject(RCTErrorUnspecified, [NSString stringWithFormat:@"Load pdf failed. path=%s",path.UTF8String], nil);
            return;
        }

        if (CGPDFDocumentIsEncrypted(pdfRef)) {

            bool isUnlocked = CGPDFDocumentUnlockWithPassword(pdfRef, [password UTF8String]);
            if (!isUnlocked) {
                CGPDFDocumentRelease(pdfRef);
                reject(RCTErrorUnspecified, @"Password required or incorrect password.", nil);
                return;
            }

        }
        if (pdfDocument != nil && pdfDocument.isLocked) {
            [pdfDocument unlockWithPassword:password];
        }

        [pdfDocRefs addObject:[NSValue valueWithPointer:pdfRef]];
        [pdfDocuments addObject:pdfDocument ?: [NSNull null]];

        numberOfPages = (int)CGPDFDocumentGetNumberOfPages(pdfRef);
        CGPDFPageRef pdfPage = CGPDFDocumentGetPage(pdfRef, 1);
        CGRect pdfPageRect = CGPDFPageGetBoxRect(pdfPage, kCGPDFMediaBox);
        int rotation = CGPDFPageGetRotationAngle(pdfPage);
        
        NSArray *params;
        
        if (rotation == 90 || rotation==270) {
             params =@[[NSNumber numberWithUnsignedLong:([pdfDocRefs count]-1)], [NSNumber numberWithInt:numberOfPages], [NSNumber numberWithFloat:pdfPageRect.size.height], [NSNumber numberWithFloat:pdfPageRect.size.width]];
            RLog(@"Pdf loaded numberOfPages=%d, fileNo=%lu, pageWidth=%f, pageHeight=%f", numberOfPages, [pdfDocRefs count]-1, pdfPageRect.size.height, pdfPageRect.size.width);

        } else {
            params =@[[NSNumber numberWithUnsignedLong:([pdfDocRefs count]-1)], [NSNumber numberWithInt:numberOfPages], [NSNumber numberWithFloat:pdfPageRect.size.width], [NSNumber numberWithFloat:pdfPageRect.size.height]];
            RLog(@"Pdf loaded numberOfPages=%d, fileNo=%lu, pageWidth=%f, pageHeight=%f", numberOfPages, [pdfDocRefs count]-1, pdfPageRect.size.width, pdfPageRect.size.height);

        }

        resolve(params);
        return;
    } else {
        reject(RCTErrorUnspecified, @"Load pdf failed. path=null", nil);
        return;
    }
}

+ (CGPDFDocumentRef) getPdf:(NSUInteger) index
{
    if (pdfDocRefs && [pdfDocRefs count]>index){
        id item = [pdfDocRefs objectAtIndex:index];
        if (![item isKindOfClass:[NSValue class]]) {
            return NULL;
        }

        return (CGPDFDocumentRef)[(NSValue *)item pointerValue];

    }

    return NULL;
}

+ (PDFDocument *) getPdfDocument:(NSUInteger) index
{
    if (pdfDocuments && [pdfDocuments count]>index){
        id item = [pdfDocuments objectAtIndex:index];
        if ([item isKindOfClass:[PDFDocument class]]) {
            return (PDFDocument *)item;
        }
    }

    return nil;
}

- (instancetype)init
{
    
    if ((self = [super init])) {

    }
    return self;

}

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

RCT_EXPORT_METHOD(closeFile:(nonnull NSNumber *)fileNo
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
                  )
{
    NSUInteger index = [fileNo unsignedIntegerValue];
    if (pdfDocRefs && [pdfDocRefs count]>index) {
        id item = [pdfDocRefs objectAtIndex:index];
        if ([item isKindOfClass:[NSValue class]]) {
            CGPDFDocumentRef pdfItem = (CGPDFDocumentRef)[(NSValue *)item pointerValue];
            if (pdfItem != NULL) {
                CGPDFDocumentRelease(pdfItem);
            }
        }
        [pdfDocRefs replaceObjectAtIndex:index withObject:[NSNull null]];
    }
    if (pdfDocuments && [pdfDocuments count]>index) {
        [pdfDocuments replaceObjectAtIndex:index withObject:[NSNull null]];
    }

    resolve([NSNull null]);
}


- (void)dealloc
{
    // release pdf docs
    for(id item in pdfDocRefs) {
        if ([item isKindOfClass:[NSValue class]]) {
            CGPDFDocumentRef pdfItem = (CGPDFDocumentRef)[item pointerValue];
            if (pdfItem != NULL) {

                CGPDFDocumentRelease(pdfItem);
                pdfItem = NULL;

            }
        }
    }
    pdfDocRefs = Nil;
    pdfDocuments = Nil;

}


@end
