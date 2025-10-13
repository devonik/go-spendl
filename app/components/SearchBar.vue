<script setup lang="ts">
import type { InputMenuItem } from '@nuxt/ui'
import products from '~/assets/products'

const localePath = useLocalePath()

const items = ref([
 {
    type: 'label',
    label: 'Payable with Bitcoin'
  },
  ...products.filter(p => p.bitcoinDiscount !== undefined),
  {
    type: 'separator'
  },
  {
    type: 'label',
    label: 'Satsback'
  },
  ...products.filter(p => p.satsbackPercent !== undefined),
] satisfies InputMenuItem[])

const value = ref()


</script>

<template>
  <UInputMenu v-model="value" icon="i-lucide-search" placeholder="Search product..." :items="items" class="w-full">
    <template #item="{ item, index}">
        <nuxt-link :key="index" :to="localePath(item.to)">
            <div class="w-full flex items-center">
                <nuxt-img :src="item.avatar?.src" :alt="item.avatar?.alt" class="w-6 h-6 rounded-full mr-2" />
                <span>{{ item.label }}</span>
            </div>
            <div class="flex mt-1 text-sm text-muted font-medium">
                <div class="mr-3">
                    <span class="" :class="{'line-through' : item.bitcoinDiscount}">{{ item.price }}</span>
                </div>
                <div v-if="item.bitcoinDiscount" class="text-yellow-500 flex gap-1">
                    <UIcon name="i-lucide-bitcoin" class="size-6 text-yellow-500" />
                     <span class="m-auto">{{item.bitcoinDiscount.finalPrice }}</span> 
                </div>
                <div v-else-if="item.satsbackPercent" class="flex gap-1">
                    <UIcon name="i-custom-satsback" class="size-6"/> 
                    <span class="m-auto">{{ item.satsbackPercent }}% Satsback</span>
                </div>
            </div>
            
            
        </nuxt-link>
    </template>
  </UInputMenu>
</template>

