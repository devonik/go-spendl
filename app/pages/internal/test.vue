<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { UserClickHistoryItem, UserHistoryItem, UserPayoutItem } from '~~/types/satsback'

const { getClicks, getHistory, getPayouts } = useSatsbackApi()

// --- Clicks ---
const clicks = ref<UserClickHistoryItem[]>([])
const clicksStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const clicksError = ref<string>()

const clickColumns: TableColumn<UserClickHistoryItem>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'store_name', header: 'Store' },
  { accessorKey: 'created_at', header: 'Date' },
]

async function fetchClicks() {
  clicksStatus.value = 'loading'
  clicksError.value = undefined
  try {
    const resp = await getClicks()
    clicks.value = resp?.data ?? []
    clicksStatus.value = 'success'
  }
  catch (err: unknown) {
    clicksError.value = String(err)
    clicksStatus.value = 'error'
  }
}

// --- History ---
const history = ref<UserHistoryItem[]>([])
const historyStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const historyError = ref<string>()

const historyColumns: TableColumn<UserHistoryItem>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'store_name', header: 'Store' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'created_at', header: 'Date' },
]

async function fetchHistory() {
  historyStatus.value = 'loading'
  historyError.value = undefined
  try {
    const resp = await getHistory()
    history.value = resp?.data ?? []
    historyStatus.value = 'success'
  }
  catch (err: unknown) {
    historyError.value = String(err)
    historyStatus.value = 'error'
  }
}

// --- Payouts ---
const payouts = ref<UserPayoutItem[]>([])
const payoutsStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const payoutsError = ref<string>()

const payoutColumns: TableColumn<UserPayoutItem>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'payout_type', header: 'Type' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'created_at', header: 'Date' },
]

async function fetchPayouts() {
  payoutsStatus.value = 'loading'
  payoutsError.value = undefined
  try {
    const resp = await getPayouts()
    payouts.value = resp?.data ?? []
    payoutsStatus.value = 'success'
  }
  catch (err: unknown) {
    payoutsError.value = String(err)
    payoutsStatus.value = 'error'
  }
}
</script>

<template>
  <div class="p-8 space-y-8 max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold">
      Internal Playground
    </h1>

    <!-- Clicks -->
    <section class="space-y-4">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">
          GET /api/satsback/user/clicks
        </h2>
        <UButton size="sm" :loading="clicksStatus === 'loading'" @click="fetchClicks">
          Fetch
        </UButton>
      </div>

      <UAlert v-if="clicksStatus === 'error'" color="error" :description="clicksError" />

      <div v-if="clicksStatus === 'success'">
        <p v-if="clicks.length === 0" class="text-sm text-gray-500">
          No clicks found.
        </p>
        <UTable v-else :data="clicks" :columns="clickColumns" />
      </div>
    </section>

    <!-- History -->
    <section class="space-y-4">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">
          GET /api/satsback/user/history
        </h2>
        <UButton size="sm" :loading="historyStatus === 'loading'" @click="fetchHistory">
          Fetch
        </UButton>
      </div>

      <UAlert v-if="historyStatus === 'error'" color="error" :description="historyError" />

      <div v-if="historyStatus === 'success'">
        <p v-if="history.length === 0" class="text-sm text-gray-500">
          No history found.
        </p>
        <UTable v-else :data="history" :columns="historyColumns" />
      </div>
    </section>
    <!-- Payouts -->
    <section class="space-y-4">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">
          GET /api/satsback/user/payouts
        </h2>
        <UButton size="sm" :loading="payoutsStatus === 'loading'" @click="fetchPayouts">
          Fetch
        </UButton>
      </div>

      <UAlert v-if="payoutsStatus === 'error'" color="error" :description="payoutsError" />

      <div v-if="payoutsStatus === 'success'">
        <p v-if="payouts.length === 0" class="text-sm text-gray-500">
          No payouts found.
        </p>
        <UTable v-else :data="payouts" :columns="payoutColumns" />
      </div>
    </section>
  </div>
</template>
