<br />
<div align="center">
  <!-- Default Logo for Light Mode -->
  <img 
    src="https://i.ibb.co/hdQR89W/frontegg-logo-black.png" 
    alt="Frontegg Logo" 
    width="400" 
    height="90"
    id="logo"
    style="display: block;"
  >
  <!-- Alternate Logo for Dark Mode -->
  <img 
    src="https://i.ibb.co/gtpj5kT/frontegg-logo-white.png" 
    alt="Frontegg Logo (Dark Mode)" 
    width="400" 
    height="90" 
    id="logo-dark"
    style="display: block;"
  >

  <h3 align="center">Frontegg's OpenAPI Specifications</h3>
</div>

<style>
  @media (prefers-color-scheme: dark) {
    #logo {
      display: none;
    }
    #logo-dark {
      display: block;
    }
  }
</style>

## OpenAPI Specifications 

This repository provides the OpenAPI specifications for all our services in one place, ensuring you have access to the latest API definitions for integration and development.

## Combined OpenAPI Specification

In this repository, you'll find a file named `combined.json`, which consolidates the OpenAPI specifications of all our services into a single document.  

This file is especially useful if you want to generate a client library to interact with multiple APIs from your backend or other applications. By using `combined.json`, you can streamline development and avoid managing separate OpenAPI files for each service.

Find an example in our [documentation](https://developers.frontegg.com/api/overview#using-as-an-sdk)


## Stay Updated

To keep track of changes, additions, or deprecations in our APIs, we recommend watching this repository for releases.  

### How to Watch for Releases

1. Click the **Watch** button at the top of the page.  
2. Select **Custom** and enable **Releases**.  

You'll receive notifications whenever new updates are published.  

## Feedback

If you have questions or suggestions, please open an issue. Your feedback helps us improve!  

Thank you for using our APIs!