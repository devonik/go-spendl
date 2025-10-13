
export default defineEventHandler(async (event) => {
  const browser_config_payload = {
    "type": "BrowserConfig",
    "params": {"headless": true, java_script_enabled: true}
}
const js_click_tabs = `
    (async () => {
        const tabs = document.querySelectorAll("section.charge-methodology .tabs-menu-3 > div");
        for(let tab of tabs) {
            tab.scrollIntoView();
            tab.click();
            await new Promise(r => setTimeout(r, 500));
        }
    })();
    `
const crawler_config_payload = {
    "type": "CrawlerRunConfig",
    "params": {
      "cache_mode": "bypass",
      "extraction_strategy": {
                "type": "JsonCssExtractionStrategy",
                "params": {
                    "schema": {
                        "type": "dict",
                        "value": {
                           "baseSelector": "main",
                           "fields": [
                               {
      "name": "name",
      "selector": "div.grid.grid-cols-12 > div.col-span-12.flex > h1.text-size-h4",
      "type": "text"
    },
    {
      "name": "price",
      "selector": "div.col-span-12.flex > div.MuiBox-root.mui-13brihr > div.MuiTypography-root.MuiTypography-h4",
      "type": "text"
    }
                           ]
                         }
                    }
                }
            }
      /*"extraction_strategy": {
          "type": "LLMExtractionStrategy",
          "params": {
            "llm_config": {
              "type": "LLMConfig",
              "params": {"provider":"ollama/llama3", "api_token":"none", "base_url":"http://host.docker.internal:11434"},
              //"params": {"provider":"openai/gpt-4o-mini", "api_token":""},
              
              
              
            },
            instruction:"Extract product names and their prices from the page. Return the result as a JSON array with objects containing 'name' and 'price' fields."
            
        }
      },*/
      /*virtual_scroll_config: {
        type: "VirtualScrollConfig",
        params: {
          container_selector:"#feed",      // CSS selector for scrollable container
          scroll_count:20,                 // Number of scrolls to perform
          scroll_by:"container_height",    // How much to scroll each time
          wait_after_scroll:0.5           // Wait time (seconds) after each scroll
        }
      }*/
    }
  }

const crawl_payload = {
    "urls": ["https://www.baur.de/p/AKLBB2032065253?nav-i=1&nav-q=Garmin+Smartwatch&nav-q=Garmin+Smartwatch&p=1&sku=9100946852-0"],
    "browser_config": browser_config_payload,
    "crawler_config": crawler_config_payload
}
/*
const response = await $fetch("http://localhost:11235/md",{
    method: 'post',
    body: {
        "url": "https://www.baur.de/s/Garmin+Smartwatch/",
        "f": "llm",
        "q": "Extract product names and their prices from the page. Return the result as a JSON array with objects containing 'name' and 'price' fields.",
        "temperature": 0.2
    }
  })
*/

const response = await $fetch("http://localhost:11235/crawl",{
    method: 'post',
    body: crawl_payload
  })
  console.log("Crawl response:", response)
  return "hello"
})

