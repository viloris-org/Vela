import { describe, expect, test } from "bun:test";
import {
  appKitPointToLogical,
  appKitRectToLogical,
  logicalPointToAppKit,
  logicalRectToAppKit,
} from "./coordinates.ts";

describe("coordinates", () => {
  test("appKitPointToLogical converts a bottom-origin point to logical space", () => {
    // Given
    const appKitPoint = { x: 10, y: 50 };
    const contentHeight = 600;

    // When
    const logicalPoint = appKitPointToLogical(appKitPoint, contentHeight);

    // Then
    expect(logicalPoint).toEqual({ x: 10, y: 550 });
  });

  test("point conversion round-trips a logical point", () => {
    // Given
    const logicalPoint = { x: 10, y: 550 };
    const contentHeight = 600;

    // When
    const roundTrippedPoint = appKitPointToLogical(
      logicalPointToAppKit(logicalPoint, contentHeight),
      contentHeight,
    );

    // Then
    expect(roundTrippedPoint).toEqual(logicalPoint);
  });

  test("appKitRectToLogical places a rectangle using its top edge", () => {
    // Given
    const appKitRect = { x: 10, y: 50, width: 100, height: 20 };
    const contentHeight = 600;

    // When
    const logicalRect = appKitRectToLogical(appKitRect, contentHeight);

    // Then
    expect(logicalRect).toEqual({ x: 10, y: 530, width: 100, height: 20 });
  });

  test("rectangle conversion round-trips a logical rectangle", () => {
    // Given
    const logicalRect = { x: 10, y: 530, width: 100, height: 20 };
    const contentHeight = 600;

    // When
    const roundTrippedRect = appKitRectToLogical(
      logicalRectToAppKit(logicalRect, contentHeight),
      contentHeight,
    );

    // Then
    expect(roundTrippedRect).toEqual(logicalRect);
  });
});
