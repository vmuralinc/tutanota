//@flow
import o from "ospec/ospec.js"
import {
	appendEntities,
	calculateNeededSpace,
	encodeSearchIndexBlock, iterateSearchIndexBlocks,
	numberOfBytes,
	readSearchIndexBlock,
	removeSearchIndexRanges
} from "../../../../src/api/worker/search/SearchIndexEncoding"
import {spy as makeSpy} from "../../TestUtils"
import {concat} from "../../../../src/api/common/utils/ArrayUtils"

o.spec("SearchIndexEncoding test", function () {
	o("numberOfBytes", function () {
		[
			[0, 0],
			[128, 1],
			[255, 1],
			[256, 2],
			[257, 2],
			[511, 2],
			[512, 2],
			[Math.pow(2, 16) - 1, 2],
			[Math.pow(2, 16), 3] // 65536
		].forEach(([num, res]) => o(numberOfBytes(num)).equals(res)(`${num} should require ${res}`))
	})

	o("calculateNeededSpaceSingleArray", function () {
		o(calculateNeededSpace([new Uint8Array(32)])).deepEquals(1 + 32)
		o(calculateNeededSpace([new Uint8Array(127)])).deepEquals(128)
		o(calculateNeededSpace([new Uint8Array(128)])).deepEquals(1 + 1 + 128)
		o(calculateNeededSpace([new Uint8Array(65535)])).deepEquals(1 + 2 + 65535)
		o(calculateNeededSpace([new Uint8Array(65536)])).deepEquals(1 + 3 + 65536)
	})

	o("calculateNeededSpace", function () {
		const smallEntry = new Uint8Array(32)
		const bigEntry = new Uint8Array(512)
		o(calculateNeededSpace([smallEntry, bigEntry])).deepEquals(1 + 32 + 1 + 2 + 512)
	})

	o.spec("encodeSearchIndexBlock", function () {
		o("with short length", function () {
			const newIndexEntry = new Uint8Array([0x1]);
			const indexEntry = new Uint8Array(2);
			o(encodeSearchIndexBlock(newIndexEntry, indexEntry, 0)).equals(2)
			o(JSON.stringify(indexEntry)).deepEquals(JSON.stringify(new Uint8Array([0x01, 0x01])))
		})

		o("with large length", function () {
			const entityData = new Uint8Array(256)
			const destinationData = new Uint8Array(259);
			o(encodeSearchIndexBlock(entityData, destinationData, 0)).equals(259)
			o(JSON.stringify(destinationData)).deepEquals(JSON.stringify(new Uint8Array([0x82, 0x01, 0x00].concat(new Array(256).fill(0)))))
		})

		o("with large length, invalid offset", function () {
			const entityData = new Uint8Array(256)
			const destinationData = new Uint8Array(259)
			try {
				encodeSearchIndexBlock(entityData, destinationData, 1)
			} catch (e) {
				o(e.constructor).equals(RangeError)
			}
		})

		o("with large length, insufficient memory", function () {
			const entityData = new Uint8Array(256)
			const destinationData = new Uint8Array(2)
			try {
				encodeSearchIndexBlock(entityData, destinationData, 0)
				throw new Error()
			} catch (e) {
				o(e.constructor).equals(RangeError)
			}
		})
	})

	o.spec("readSearchIndexBlock", function () {
		o("with short length (literal length)", function () {
			const searchIndexData = new Uint8Array([0x01].concat([0x00]))
			o(JSON.stringify(readSearchIndexBlock(searchIndexData, 0))).deepEquals(JSON.stringify(new Uint8Array([0x00])))
		})

		o("with short length (encoded length)", function () {
			const searchIndexData = new Uint8Array([0x7F].concat([0x00]))
			o(JSON.stringify(readSearchIndexBlock(searchIndexData, 0))).deepEquals(JSON.stringify(new Uint8Array([0x00])))
		})

		o("with long length", function () {
			const searchIndexData = new Uint8Array([0x81, 0x01].concat([0x01, 0x02, 0x03]))
			o(JSON.stringify(readSearchIndexBlock(searchIndexData, 0))).deepEquals(JSON.stringify(new Uint8Array([0x01])))
		})

		o("with long length and offset", function () {
			const searchIndexData = new Uint8Array([0x00, 0x82, 0x01, 0x00].concat(new Array(256).fill(0x00)))
			o(JSON.stringify(readSearchIndexBlock(searchIndexData, 1))).deepEquals(JSON.stringify(new Uint8Array(256)))
		})
	})

	o.spec("removeSearchIndexRanges", function () {
		o("works", function () {
			const row =
				new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
			const expected =
				new Uint8Array([1, 3, 6])
			o(JSON.stringify(removeSearchIndexRanges(row, [[0, 1], [2, 3], [4, 6], [7, 8]]))).equals(JSON.stringify(expected))
		})
	})

	o.spec("iterateSearchIndexBlocks", function () {
		o("works", function () {
			const shortBlock = [0x01, 0x00] // literal length & data
			const longBlock = [0x81, 0x03, 0x01, 0x02, 0x03] // first byte - length of length, second length of data, rest is data
			const anotherLongBlock = [0x81, 0x01, 0x01] // first byte - length of length, second length of data, rest is data

			// 0 1 2 3 4 5 6 7 8 9 10
			// l d d d l l l d d l
			// "i" - length, "d" data
			const row = new Uint8Array(shortBlock.concat(longBlock).concat(anotherLongBlock))
			const spy = makeSpy()
			iterateSearchIndexBlocks(row, spy)
			o(JSON.stringify(spy.invocations)).equals(JSON.stringify([
				[new Uint8Array(shortBlock.slice(1)), 0, 2, 0],
				[new Uint8Array(longBlock.slice(2)), 2, 7, 1],
				[new Uint8Array(anotherLongBlock.slice(2)), 7, 10, 2]
			]))
		})
	})

	o.spec("appendEntities", function () {
		o("resizes when needed", function () {
			const row = new Uint8Array([0x01, 0x02])
			const newDataOne = new Uint8Array(256).fill(2)
			const newDataTwo = new Uint8Array([0x01])

			const expected = concat(new Uint8Array([0x01, 0x02]), new Uint8Array([0x82, 0x01, 0x00]), newDataOne, new Uint8Array([0x01, 0x01]))

			o(JSON.stringify(appendEntities([newDataOne, newDataTwo], row))).equals(JSON.stringify(expected))
		})
	})
})