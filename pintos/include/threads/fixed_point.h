#ifndef THREADS_FIXED_POINT_H
#define THREADS_FIXED_POINT_H

#include <stdint.h>

/* [Project 1 · MLFQS] 17.14 고정소수점 연산
   (Pintos 매뉴얼 부록 B.6 "Fixed-Point Real Arithmetic").

   고정소수점 수 x는 실수 x / F를 뜻한다 (F = 2^14 = 16384).
   아래에서 n은 항상 int, x와 y는 항상 고정소수점이다. */

typedef int32_t fp_t;

#define FP_SHIFT 14
#define FP_F (1 << FP_SHIFT)

/* 정수 n → 고정소수점 */
static inline fp_t fp_from_int (int n) { return n * FP_F; }

/* 고정소수점 x → 정수 (0 쪽으로 버림) */
static inline int fp_to_int_trunc (fp_t x) { return x / FP_F; }

/* 고정소수점 x → 정수 (가장 가까운 정수로 반올림) */
static inline int
fp_to_int_round (fp_t x) {
	return x >= 0 ? (x + FP_F / 2) / FP_F : (x - FP_F / 2) / FP_F;
}

/* 고정소수점 ± 고정소수점 */
static inline fp_t fp_add (fp_t x, fp_t y) { return x + y; }
static inline fp_t fp_sub (fp_t x, fp_t y) { return x - y; }

/* 고정소수점 ± 정수 */
static inline fp_t fp_add_int (fp_t x, int n) { return x + n * FP_F; }
static inline fp_t fp_sub_int (fp_t x, int n) { return x - n * FP_F; }

/* 고정소수점 × 고정소수점, 고정소수점 ÷ 고정소수점.
   중간 곱이 32비트를 넘지 않도록 64비트로 넓혀 계산한다. */
static inline fp_t fp_mul (fp_t x, fp_t y) { return ((int64_t) x) * y / FP_F; }
static inline fp_t fp_div (fp_t x, fp_t y) { return ((int64_t) x) * FP_F / y; }

/* 고정소수점 × 정수, 고정소수점 ÷ 정수 */
static inline fp_t fp_mul_int (fp_t x, int n) { return x * n; }
static inline fp_t fp_div_int (fp_t x, int n) { return x / n; }

#endif /* threads/fixed_point.h */
