<script lang="ts" setup>
import { AisRefinementList, AisClearRefinements, AisRangeInput } from "vue-instantsearch/vue3/es";

const showFilter = ref(false);

function formatMinValue(minValue, minRange) {
      return minValue !== null && minValue !== minRange ? minValue : "";
    }
function formatMaxValue(maxValue, maxRange) {
  return maxValue !== null && maxValue !== maxRange ? maxValue : "";
}

</script>

<template>
  <!--Filter TODO export as component-->
  <div class="flex-col gap-6" >
    <UButton class="cursor-pointer" color="primary" block icon="i-lucide-filter" @click="showFilter = !showFilter">
      {{ $t('search.filter.label') }}
    </UButton>
  
    <Transition mode="out-in"> 
      <div v-if="showFilter" class="flex flex-col gap-3">
        
        <ais-clear-refinements>
          <template #default="{ canRefine, refine, createURL }">
            <UButton class=" text-red-400 mt-3" variant="subtle" block icon="i-lucide-brush-cleaning" :disabled="!canRefine" @click="refine">
              {{ $t('search.filter.clearAllFilters') }}
            </UButton>
          </template>
        </ais-clear-refinements>
        
        <!-- Group Refinement List -->
        <div>
          <span class="text-lg text-bold">{{ $t('search.filter.categories') }}</span>
          <ais-refinement-list attribute="group" :limit="5">
            <template #item="{ item, refine, createURL }">
              <UCheckbox v-model:model-value="item.isRefined" class="my-1" :label="item.value" variant="card" @change="refine(item.value)"> 
                <template #label>
                  <div class="flex gap-3">
                    {{ $t(`search.productGroups.${item.value}`) }} <UBadge variant="outline">{{ item.count }}</UBadge>
                  </div>
                </template>
              </UCheckbox>
            </template>
          </ais-refinement-list>
        </div>
        <!-- Brand Refinement List -->
        <div>
          <span class="text-lg text-bold">{{ $t('search.filter.brands') }}</span>
          <ais-refinement-list attribute="brand" :limit="5">
            <template #item="{ item, refine, createURL }">
              <UCheckbox v-model:model-value="item.isRefined" class="my-1" :label="item.value" variant="card" @change="refine(item.value)"> 
                <template #label>
                  <div class="flex gap-3">
                    {{ item.value }} <UBadge variant="outline">{{ item.count }}</UBadge>
                  </div>
                </template>
              </UCheckbox>
            </template>
          </ais-refinement-list>
        </div>
        <!-- Color Refinement List -->
        <div>
          <span class="text-lg text-bold">{{ $t('search.filter.colors') }}</span>
          <ais-refinement-list attribute="colors" :limit="5">
            <template #item="{ item, refine, createURL }">
              <UCheckbox v-model:model-value="item.isRefined" class="my-1" :label="item.value" variant="card" @change="refine(item.value)"> 
                <template #label>
                  <div class="flex gap-3">
                    {{ item.value }} <UBadge variant="outline">{{ item.count }}</UBadge>
                  </div>
                </template>
              </UCheckbox>
            </template>
          </ais-refinement-list>
        </div>
        <!-- Price Range Input -->
        <div>
          <span class="text-lg text-bold">{{ $t('search.filter.priceRange') }}</span>
          <ais-range-input attribute="price" class="flex gap-2">
            <template #default="{ currentRefinement, range, canRefine, refine }">
              <UInput
                  type="number"
                  class="w-24"
                  :min="range.min"
                  :max="range.max"
                  :placeholder="range.min"
                  :disabled="!canRefine"
                  :value="formatMinValue(currentRefinement.min, range.min)"
                  icon="i-lucide-euro"
                  @input="
                    refine({
                      min: $event.currentTarget.value,
                      max: formatMaxValue(currentRefinement.max, range.max),
                    })
                  "
                />
                <span class="m-3">-</span>
                <UInput
                  type="number"
                  class="w-24"
                  :min="range.min"
                  :max="range.max"
                  :placeholder="range.max"
                  :disabled="!canRefine"
                  :value="formatMinValue(currentRefinement.max, range.max)"
                  icon="i-lucide-euro"
                  @input="
                    refine({
                      min: formatMinValue(currentRefinement.min, range.min),
                      max: $event.currentTarget.value,
                    })
                  "
                />
              </template>
          </ais-range-input>
        </div>
      </div>
    </Transition>
    </div>
</template>

<style scoped>
.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>