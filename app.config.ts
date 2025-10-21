export default defineAppConfig({
  ui: {
    colors: {
      test: 'purple',
    },
    theme: {
      color: [
        'test',
      ],
    },
    pageSection: {
      slots: {
        container: 'flex flex-col lg:grid py-12 sm:gap-16',
      },
    },
  },
})
