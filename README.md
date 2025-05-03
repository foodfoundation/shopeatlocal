<p align="center">
  <a href="https://github.com/foodfoundation/shopeatlocal">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://images.squarespace-cdn.com/content/v1/602be723610d6f1042eca6f1/aaff1210-bb6a-4863-9324-c33e348a918f/Cultivate+Logo+%26+Tagline+-+Color.png">
      <img src="https://images.squarespace-cdn.com/content/v1/602be723610d6f1042eca6f1/aaff1210-bb6a-4863-9324-c33e348a918f/Cultivate+Logo+%26+Tagline+-+Color.png" height="128">
    </picture>
    <h1 align="center">shopeatlocal</h1>
  </a>
</p>

## Getting started

`shopeatlocal` is one of the World's most feature complete tool to manage an online marketplace where you can connect your local food procuders and consumers. Features include producer management, member management, product search, a battle-hardened cycle management system, website management and much more.

`shopeatlocal` is maintained by the board at [Cultivate Food Connections](https://cultivatefoodconnections.org/). Feel more than free to contact us for help with getting your local market running!

If you're a developer and want to take part in developing `shopeatlocal`, please head on to our [wiki](https://github.com/foodfoundation/shopeatlocal/wiki) and educate there on how you can get started.

## Local development

### Prerequisites

- Docker
- npm

### Process

1. `cd app` and `docker compose up -d`
2. `cp app/Extra/Cfg.js_example app/Cfg.js`
3. `npm install`
4. `npm run dev`

## Kubernetes via github actions

If you would like to deploy this project, we have an example of containerizing it and deploying those container to kubernetes via github actions.
The process has three legs, containerize, push images, and k8s resources. With these examples a fork of this repo can be made to deploy.

### Containerize

This project has a few moving pieces that need to be build and copied to have a runnable site.

- [Dockerfile](Dockerfile): places the cfg.js in the right place, builds the producer reports static js, builds the handlebars app, and packages it all into a node container.
- [migrations.Dockerfile](migrations.Dockerfile): wraps sql files in [Extra](app%2FExtra) in [flyway](https://hub.docker.com/r/flyway/flyway) and configures environment variables for connecting to a mysql instance

### Push

Executing the build for these dockerfiles happens via [Github Actions](https://github.com/features/actions).

- [Docker Push App](.github/workflows/deploy.yaml:48): pushes a new version of the app container to [ghcp.io](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). It will be tagged with `sha-{{commit sha}}`.
- [Docker Push Migrations](.github/workflows/deploy.yaml:84): pushes a new version of the flyway container to ghcp.io.

Note: there are fields in these pipelines that are specific to the repo the pipeline runs in. Consider changing them if you fork this repo.

### Kubernetes

The final leg of the process is declaring k8s resources that could be used to production-alize the application. 

- [Deploy K8s](.github/workflows/deploy.yaml:15): This workflow deploys the following resources to kubernetes. 
  Note that it requires a [kube config as a github actions secret](.github/workflows/deploy.yaml:34). This can be [generated](https://stackoverflow.com/a/47776588/3430807) from a namespace scoped service account.
  Also note that a secret is required to pull images from ghcr. See [this guide](https://dev.to/asizikov/using-github-container-registry-with-kubernetes-38fb).
  - [deployment.yaml](k8s-resources%2Fdeployment.yaml): the main deployment of the app. It uses the migrations image as an [initContainer](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/) to apply migrations to the mysql database. 
    - [kustomization.yaml](k8s-resources%2Fkustomization.yaml): configures the image tags used in the deployment
  - [mysql.yaml](k8s-resources%2Fmysql.yaml): single instance deployment of mysql:9
  - [ingress.yaml](k8s-resources%2Fingress.yaml): an ingress permitting traffic to the app container

Note: there are a number of fields in these resources related to the purpose of the deployment, consider changing the namespace and domain name. 

## Security

If you find a security vulnerability in the codebase, we would like to kindly ask you not to open a public issue, but reach out to us at [shopeatlocal.security@neonjelly.co](mailto:shopeatlocal.security@neonjelly.co).

## Acknowledgment

### Current maintainers

[Neonjelly Studio](https://github.com/neonjelly-co)

### Previous maintainers:

[Antefix-consulting](https://github.com/antefix-consulting)
[cspellsoftware](https://github.com/cspellsoftware)
[BrandonFroncek-PellSoftware](https://github.com/BrandonFroncek-PellSoftware)

### Sound effects

[pan14](https://freesound.org/people/pan14/sounds/263133/) [Autistic Lucario](https://freesound.org/people/Autistic%20Lucario/sounds/142608/), and [Abacagi](https://freesound.org/people/Abacagi/sounds/517152/) on [Freesound](https://freesound.org/).
