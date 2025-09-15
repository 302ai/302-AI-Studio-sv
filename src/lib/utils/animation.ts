/**
 * 动画工具函数模块
 * 提供可复用的动画工具函数
 */

import { Spring } from "svelte/motion";

/**
 * 延迟执行工具函数
 * @param ms - 延迟毫秒数
 * @returns Promise
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 关键帧动画配置接口
 */
export interface AnimationKeyframe<T> {
	target: T;
	duration: number;
}

/**
 * 执行弹簧动画序列
 * @param spring - Svelte Spring 实例
 * @param keyframes - 动画关键帧配置数组
 * @param onComplete - 动画完成回调
 */
export async function animateSpringSequence<T>(
	spring: Spring<T>,
	keyframes: Array<AnimationKeyframe<T>>,
	onComplete?: () => void,
) {
	for (const keyframe of keyframes) {
		spring.target = keyframe.target;
		await delay(keyframe.duration);
	}
	onComplete?.();
}

/**
 * 按钮弹跳动画配置
 */
export interface ButtonBounceConfig {
	intensity?: number;
	duration?: number;
}

/**
 * 执行按钮弹跳动画
 * @param spring - 弹簧实例
 * @param type - 动画类型 ('new' | 'close')
 * @param config - 可选配置
 */
export async function animateButtonBounce(
	spring: Spring<{ x: number }>,
	type: "new" | "close",
	config?: ButtonBounceConfig,
) {
	const intensity = config?.intensity ?? 1;
	const baseDuration = config?.duration ?? 120;

	if (type === "new") {
		await animateSpringSequence(spring, [
			{ target: { ...spring.current, x: 15 * intensity }, duration: baseDuration },
			{ target: { ...spring.current, x: -8 * intensity }, duration: baseDuration },
			{ target: { ...spring.current, x: 0 }, duration: baseDuration },
		]);
	} else {
		await animateSpringSequence(spring, [
			{ target: { ...spring.current, x: -12 * intensity }, duration: baseDuration + 30 },
			{ target: { ...spring.current, x: 0 }, duration: baseDuration + 30 },
		]);
	}
}

/**
 * 淡入淡出动画配置
 */
export interface FadeConfig {
	fromOpacity?: number;
	toOpacity?: number;
	duration?: number;
}

/**
 * 执行淡入淡出动画
 * @param spring - 弹簧实例
 * @param config - 可选配置
 */
export async function animateFade(spring: Spring<{ opacity: number }>, config?: FadeConfig) {
	const fromOpacity = config?.fromOpacity ?? spring.current.opacity;
	const toOpacity = config?.toOpacity ?? 1;
	const duration = config?.duration ?? 200;

	await animateSpringSequence(spring, [
		{ target: { ...spring.current, opacity: fromOpacity }, duration: duration / 2 },
		{ target: { ...spring.current, opacity: toOpacity }, duration: duration / 2 },
	]);
}

/**
 * 滑动动画配置
 */
export interface SlideConfig {
	fromX?: number;
	toX?: number;
	duration?: number;
}

/**
 * 执行滑动动画
 * @param spring - 弹簧实例
 * @param config - 可选配置
 */
export async function animateSlide(spring: Spring<{ x: number }>, config?: SlideConfig) {
	const fromX = config?.fromX ?? spring.current.x;
	const toX = config?.toX ?? 0;
	const duration = config?.duration ?? 200;

	await animateSpringSequence(spring, [
		{ target: { ...spring.current, x: fromX }, duration: duration / 2 },
		{ target: { ...spring.current, x: toX }, duration: duration / 2 },
	]);
}
