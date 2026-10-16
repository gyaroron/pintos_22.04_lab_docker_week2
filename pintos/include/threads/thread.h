#ifndef THREADS_THREAD_H
#define THREADS_THREAD_H

#include <debug.h>
#include <list.h>
#include <stdint.h>
#include "threads/interrupt.h"
#ifdef VM
#include "vm/vm.h"
#endif


/* States in a thread's life cycle. */
enum thread_status {
	THREAD_RUNNING,     /* Running thread. */
	THREAD_READY,       /* Not running but ready to run. */
	THREAD_BLOCKED,     /* Waiting for an event to trigger. */
	THREAD_DYING        /* About to be destroyed. */
};

/* Thread identifier type.
   You can redefine this to whatever type you like. */
typedef int tid_t;
#define TID_ERROR ((tid_t) -1)          /* Error value for tid_t. */

/* Thread priorities. */
#define PRI_MIN 0                       /* Lowest priority. */
#define PRI_DEFAULT 31                  /* Default priority. */
#define PRI_MAX 63                      /* Highest priority. */

/* [Project 1 · MLFQS] nice 값의 범위 */
#define NICE_MIN -20
#define NICE_DEFAULT 0
#define NICE_MAX 20

/* [Project 1 · Priority Donation] donation이 lock 소유자 사슬을
   따라갈 수 있는 최대 단계 수 (nested donation 깊이) */
#define DONATION_MAX_DEPTH 8

/* 전방 선언: struct lock은 threads/synch.h에 있다 (waiting_lock용) */
struct lock;

/* A kernel thread or user process.
 *
 * Each thread structure is stored in its own 4 kB page.  The
 * thread structure itself sits at the very bottom of the page
 * (at offset 0).  The rest of the page is reserved for the
 * thread's kernel stack, which grows downward from the top of
 * the page (at offset 4 kB).  Here's an illustration:
 *
 *      4 kB +---------------------------------+
 *           |          kernel stack           |
 *           |                |                |
 *           |                |                |
 *           |                V                |
 *           |         grows downward          |
 *           |                                 |
 *           |                                 |
 *           |                                 |
 *           |                                 |
 *           |                                 |
 *           |                                 |
 *           |                                 |
 *           |                                 |
 *           +---------------------------------+
 *           |              magic              |
 *           |            intr_frame           |
 *           |                :                |
 *           |                :                |
 *           |               name              |
 *           |              status             |
 *      0 kB +---------------------------------+
 *
 * The upshot of this is twofold:
 *
 *    1. First, `struct thread' must not be allowed to grow too
 *       big.  If it does, then there will not be enough room for
 *       the kernel stack.  Our base `struct thread' is only a
 *       few bytes in size.  It probably should stay well under 1
 *       kB.
 *
 *    2. Second, kernel stacks must not be allowed to grow too
 *       large.  If a stack overflows, it will corrupt the thread
 *       state.  Thus, kernel functions should not allocate large
 *       structures or arrays as non-static local variables.  Use
 *       dynamic allocation with malloc() or palloc_get_page()
 *       instead.
 *
 * The first symptom of either of these problems will probably be
 * an assertion failure in thread_current(), which checks that
 * the `magic' member of the running thread's `struct thread' is
 * set to THREAD_MAGIC.  Stack overflow will normally change this
 * value, triggering the assertion. */
/* The `elem' member has a dual purpose.  It can be an element in
 * the run queue (thread.c), or it can be an element in a
 * semaphore wait list (synch.c).  It can be used these two ways
 * only because they are mutually exclusive: only a thread in the
 * ready state is on the run queue, whereas only a thread in the
 * blocked state is on a semaphore wait list. */
struct thread {
	/* Owned by thread.c. */
	tid_t tid;                          /* Thread identifier. */
	enum thread_status status;          /* Thread state. */
	char name[16];                      /* Name (for debugging purposes). */
	int priority;                       /* 실효 priority (donation · MLFQS 반영 후) */

	/* Shared between thread.c and synch.c. */
	struct list_elem elem;              /* ready_list · sema waiters · sleep_list 중 한 곳에 들어가는 elem */

	/* [Project 1 · Alarm Clock] (thread.c, devices/timer.c) */
	int64_t wakeup_tick;                /* 잠든 스레드가 깨어나야 할 tick */

	/* [Project 1 · Priority Donation] (thread.c, synch.c) */
	int base_priority;                  /* thread_set_priority()로 정한 원래 priority (donation 받기 전) */
	struct lock *waiting_lock;          /* 지금 기다리는 lock. 없으면 NULL */
	struct list donations;              /* 나에게 priority를 donate한 스레드들 */
	struct list_elem donation_elem;     /* lock 소유자의 donations에 들어갈 때 쓰는 elem */

	/* [Project 1 · MLFQS] (thread.c) */
	int nice;                           /* NICE_MIN ~ NICE_MAX */
	int recent_cpu;                     /* 고정소수점: 최근에 받은 CPU 시간 */
	struct list_elem all_elem;          /* all_list에 들어갈 때 쓰는 elem */

#ifdef USERPROG
	/* Owned by userprog/process.c. */
	uint64_t *pml4;                     /* Page map level 4 */
#endif
#ifdef VM
	/* Table for whole virtual memory owned by thread. */
	struct supplemental_page_table spt;
#endif

	/* Owned by thread.c. */
	struct intr_frame tf;               /* Information for switching */
	unsigned magic;                     /* Detects stack overflow. */
};

/* If false (default), use round-robin scheduler.
   If true, use multi-level feedback queue scheduler.
   Controlled by kernel command-line option "-o mlfqs". */
extern bool thread_mlfqs;

void thread_init (void);
void thread_start (void);

void thread_tick (void);
void thread_print_stats (void);

typedef void thread_func (void *aux);
tid_t thread_create (const char *name, int priority, thread_func *, void *);

void thread_block (void);
void thread_unblock (struct thread *);

struct thread *thread_current (void);
tid_t thread_tid (void);
const char *thread_name (void);

void thread_exit (void) NO_RETURN;
void thread_yield (void);

int thread_get_priority (void);
void thread_set_priority (int);

int thread_get_nice (void);
void thread_set_nice (int);
int thread_get_recent_cpu (void);
int thread_get_load_avg (void);

/* [Project 1 · Alarm Clock] */
void thread_sleep (int64_t wakeup_tick);
void thread_wakeup (int64_t now);

/* [Project 1 · Priority Scheduling] */
bool thread_priority_more (const struct list_elem *a,
		const struct list_elem *b, void *aux);
void thread_preempt (void);
void thread_refresh_priority (struct thread *t);

void do_iret (struct intr_frame *tf);

#endif /* threads/thread.h */
