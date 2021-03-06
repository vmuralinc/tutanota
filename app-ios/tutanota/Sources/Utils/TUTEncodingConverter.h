//
//  TUTEncodingConverter.h
//  CryptoIos
//
//  Created by Tutao GmbH on 20.10.16.
//  Copyright © 2016 Tutao GmbH. All rights reserved.
//
@interface TUTEncodingConverter : NSObject

+ (NSData*)hexToBytes:(NSString*)hex;
+ (NSString*)bytesToHex:(NSData*)data;
+ (NSData*)base64ToBytes:(NSString*)base64String;
+ (NSString*)bytesToBase64:(NSData*)bytes;
+ (NSData*)stringToBytes:(NSString*)string;
+ (NSString*)bytesToString:(NSData*)bytes;

@end

