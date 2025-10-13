<template>
  <UApp>
    <LayoutHeader/>
    <UMain>
      <NuxtLayout>
        <UContainer class="py-6">
          <NuxtPage />
        </UContainer>
      </NuxtLayout>
    </UMain>
    <USeparator icon="i-simple-icons-nuxtdotjs" type="dashed" class="h-px" />
    <LayoutFooter/>
  </UApp>
</template>