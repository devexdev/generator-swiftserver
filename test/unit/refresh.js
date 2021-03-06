/*
 * Copyright IBM Corporation 2016-2017
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'
var assert = require('yeoman-assert')
var helpers = require('yeoman-test')
var path = require('path')
var fs = require('fs')
var nock = require('nock')
var mkdirp = require('mkdirp')

var refreshGeneratorPath = path.join(__dirname, '../../refresh')
var commonTest = require('../lib/common_test.js')

// Short names for commonTest values
var generatedSourceDir = commonTest.generatedSourceDir
var applicationSourceFile = commonTest.applicationSourceFile
var routesSourceDir = commonTest.routesSourceDir

var bxdevConfigFile = commonTest.bxdevConfigFile
var cloudFoundryManifestFile = commonTest.cloudFoundryManifestFile
var cloudFoundryFiles = commonTest.cloudFoundryFiles
var bluemixFiles = commonTest.bluemixFiles
var deploymentRegion = commonTest.deploymentRegion
var deploymentSpace = commonTest.deploymentSpace
var deploymentOrg = commonTest.deploymentOrg
var toolchainName = commonTest.toolchainName

describe('Unit tests for swiftserver:refresh', function () {
  describe('invalid spec', function () {
    describe('missing appType', function () {
      var runContext
      var error = null

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({ specObj: {} })
        return runContext.toPromise().catch(function (err) {
          error = err
        })
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('aborted the generator with an error', function () {
        assert(error, 'Should throw an error')
        assert(error.message.match('^.*appType is missing.*$'), 'Thrown error should be about missing appType, it was: ' + error)
      })
    })

    describe('invalid appType', function () {
      var runContext
      var error = null

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'tomato'
            }
          })
        return runContext.toPromise().catch(function (err) {
          error = err
        })
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('aborted the generator with an error', function () {
        assert(error, 'Should throw an error')
        assert(error.message.match('^.*appType is invalid.*$'), 'Thrown error should be about invalid appType, it was: ' + error)
      })
    })

    describe('missing appName', function () {
      var runContext
      var error = null

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold'
            }
          })
        return runContext.toPromise().catch(function (err) {
          error = err
        })
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('aborted the generator with an error', function () {
        assert(error, 'Should throw an error')
        assert(error.message.match('^.*appName is missing.*$'), 'Thrown error should be about missing appName, it was: ' + error)
      })
    })

    describe('service missing name', function () {
      var runContext
      var error = null

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: 'myapp',
              bluemix: {
                backendPlatform: 'SWIFT',
                cloudant: [{ serviceInfo: {label: 'cloudant'} }]
              }
            }
          })
        return runContext.toPromise().catch(function (err) {
          error = err
        })
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('aborted the generator with an error', function () {
        assert(error, 'Should throw an error')
        assert(error.message.match('Service name is missing.*$'), 'Thrown error should be about missing service name, it was: ' + error)
      })
    })

    describe('both openApi spec and fromSwagger specified', function () {
      var runContext
      var error

      before(function () {
        // var swagger = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources/person_dino.json'), 'utf8'))
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: 'myapp',
              bluemix: {
                backendPlatform: 'SWIFT',
                openApiServers: [{ spec: '{ swagger doc }' }]
              },
              fromSwagger: '/path/to/swagger/file'
            }
          })
        return runContext.toPromise().catch(function (err) {
          error = err
        })
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('aborted the generator with an error', function () {
        assert(error, 'Should throw an error')
        assert(error.message.match('cannot handle two sources of API definition'), 'Thrown error should be about two sources for API definition, it was: ' + error)
      })
    })
  })

  describe('crud', function () {
    describe('todo application', function () {
      var applicationName = 'todo'
      var executableModule = applicationName
      var swaggerFile = `definitions/${applicationName}.yaml`
      var todoModel = {
        name: 'todo',
        plural: 'todos',
        classname: 'Todo',
        properties: {
          id: {
            type: 'string',
            id: true
          },
          title: {
            type: 'string'
          }
        }
      }

      describe('base', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'crud',
                appName: applicationName,
                models: [ todoModel ]
              }
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itUsedDefaultDestinationDirectory()

        commonTest.itCreatedCommonFiles(executableModule)
        commonTest.itHasCorrectFilesForSingleShotFalse()

        commonTest.itHasPackageDependencies([
          'Kitura',
          'HeliumLogger',
          'CloudEnvironment',
          'Health'
        ])

        commonTest.itCreatedRoutes([
          'Health',
          'Swagger'
        ])

        commonTest.itDidNotCreateServiceFiles()
        commonTest.itDidNotCreateMetricsFiles()

        it('created CRUD source files', function () {
          assert.file(commonTest.crudSourceFiles)
        })

        it('has correct content in CRUDResources.swift', function () {
          assert.fileContent(`${generatedSourceDir}/CRUDResources.swift`, 'TodoResource(factory: factory)')
        })
        it(`created ${todoModel.name} model file`, function () {
          assert.file(commonTest.modelFileGenerator(todoModel.name))
        })

        it(`README has correct content`, function () {
          assert.fileContent(`README.md`, 'Create Toolchain')
        })

        it(`created ${todoModel.name} source files`, function () {
          assert.file(commonTest.modelSourceFilesGenerator(todoModel.classname))
        })

        it(`created ${todoModel.name} content`, function () {
          assert.fileContent(`${generatedSourceDir}/${todoModel.classname}.swift`, `public init(id: String?, title: String?) {`)
        })
        it('created memory adapter', function () {
          assert.file(`${generatedSourceDir}/${todoModel.classname}MemoryAdapter.swift`)
        })

        it('adapter factory uses memory adapter', function () {
          assert.fileContent(`${generatedSourceDir}/AdapterFactory.swift`, `${todoModel.classname}MemoryAdapter(`)
        })

        it('created cloudfoundry files', function () {
          assert.file(cloudFoundryFiles)
        })

        it('created bluemix files', function () {
          assert.file(bluemixFiles)
        })

        it('created a swagger definition file', function () {
          assert.file(swaggerFile)
        })

        it('swagger definition contains expected content', function () {
          assert.fileContent([
            [ swaggerFile, `title: ${applicationName}` ],
            [ swaggerFile, `${todoModel.name}:` ]
          ])
        })

        it('cloudfoundry manifest contains the expected content', function () {
          assert.fileContent([
            [ cloudFoundryManifestFile, `name: ${applicationName}` ],
            [ cloudFoundryManifestFile, `command: '${executableModule}'` ],
            [ cloudFoundryManifestFile, 'random-route: true' ],
            [ cloudFoundryManifestFile, 'instances: 1' ],
            [ cloudFoundryManifestFile, 'memory: 128M' ],
            [ cloudFoundryManifestFile, 'timeout: 180' ],
            [ cloudFoundryManifestFile, 'OPENAPI_SPEC :' ]
          ])
          assert.noFileContent([
            [ cloudFoundryManifestFile, 'domain:' ],
            [ cloudFoundryManifestFile, 'host:' ],
            [ cloudFoundryManifestFile, 'namespace:' ]
          ])
        })

        /* it('cloudfoundry manifest defines health check details', function () {
          assert.fileContent([
            [ cloudFoundryManifestFile, 'health-check-type: http' ],
            [ cloudFoundryManifestFile, 'health-check-http-endpoint: /health' ]
          ])
        }) */

        it('cloudfoundry manifest defines OPENAPI_SPEC environment variable', function () {
          assert.fileContent(cloudFoundryManifestFile, 'OPENAPI_SPEC : "/swagger/api"')
        })
      })

      describe('update existing without overwriting user-owned files', function () {
        var runContext
        var dummyContent = '{ "dummyContent": "==Dummy existing content==" }'
        var userOwnedFiles = [ commonTest.readmeFile,
          commonTest.packageFile,
          commonTest.bxdevConfigFile,
          commonTest.configMappingsFile,
          commonTest.configCredentialsFile,
          commonTest.applicationSourceFile,
          commonTest.applicationSourceDir + '/Metrics.swift',
          commonTest.routesSourceDir + '/SwaggerRoutes.swift',
          commonTest.routesSourceDir + '/HealthRoutes.swift',
          commonTest.servicesSourceDir + '/ServiceAppid.swift',
          commonTest.servicesSourceDir + '/ServiceCloudant.swift',
          commonTest.servicesSourceDir + '/ServiceRedis.swift',
          commonTest.servicesSourceDir + '/ServiceMongodb.swift',
          commonTest.servicesSourceDir + '/ServiceWatsonAssistant.swift',
          commonTest.servicesSourceDir + '/ServicePush.swift',
          commonTest.servicesSourceDir + '/ServiceAlertNotification.swift',
          commonTest.servicesSourceDir + '/ServiceAutoscaling.swift',
          commonTest.servicesSourceDir + '/ServiceHypersecureDbaasMongodb'
        ]
          .concat(commonTest.cloudFoundryFiles)
          .concat(commonTest.bluemixFiles)
          .concat(commonTest.dockerFiles)
          .concat(commonTest.kubernetesFilesGenerator(applicationName))
        // TODO: add server sdk source file as user owned

        var spec = {
          appType: 'crud',
          appName: applicationName,
          models: [ todoModel ],
          docker: true,
          bluemix: {
            backendPlatform: 'SWIFT',
            appid: { serviceInfo: { name: 'myAppIDService' } },
            cloudant: [{ serviceInfo: { name: 'myCloudantService' } }],
            redis: { serviceInfo: { name: 'myRedisService' } },
            mongodb: { serviceInfo: { name: 'myMongoDBService' } },
            conversation: { serviceInfo: { name: 'myAssistantService' } },
            push: { serviceInfo: { name: 'myPushService' } },
            alertNotification: { serviceInfo: { name: 'myAlertService' } },
            autoscaling: { serviceInfo: { name: 'myAutoscalingService' } },
            hypersecuredb: { serviceInfo: { name: 'myHypersecuredbService' } }
          },
          crudservice: 'myCloudantService'
        }

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .inTmpDir(function (tmpDir) {
              // Create dummy project
              var projectMarkerFile = `${tmpDir}/${commonTest.projectMarkerFile}`
              var generatorSpecFile = `${tmpDir}/${commonTest.generatorSpecFile}`
              var generatorConfigFile = `${tmpDir}/${commonTest.generatorConfigFile}`

              var config = { 'generator-swiftserver': { version: commonTest.generatorVersion } }

              fs.writeFileSync(projectMarkerFile, '')
              fs.writeFileSync(generatorSpecFile, JSON.stringify(spec))
              fs.writeFileSync(generatorConfigFile, JSON.stringify(config))

              // Write dummy content to user owned files
              userOwnedFiles.forEach((filename) => {
                mkdirp.sync(path.dirname(filename))
                fs.writeFileSync(path.join(tmpDir, filename),
                dummyContent)
              })
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        userOwnedFiles.forEach(filename => {
          it(`does not overwrite user-owned file ${filename}`, function () {
            assert.fileContent(filename, dummyContent)
          })
        })
      })

      describe('Generate a blank application', function () {
        var runContext

        before(function () {
          var spec = {
            appType: 'scaffold',
            healthcheck: false,
            appName: applicationName,
            config: {}
          }
          runContext = helpers.run(path.join(__dirname, '../../refresh'))
            .withOptions({
              specObj: spec
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itHasNoApplicationModuleImports('Health', 'SwiftMetrics')
        commonTest.itHasNoPackageDependencies('Health', 'SwiftMetrics')
        commonTest.itHasNoApplicationModuleDependencies('Health', 'SwiftMetrics')
      })

      describe('with docker', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
                              .withOptions({
                                deploymentRegion: deploymentRegion,
                                deploymentOrg: deploymentOrg,
                                deploymentSpace: deploymentSpace,
                                toolchainName: toolchainName,
                                specObj: {
                                  appType: 'crud',
                                  appName: applicationName,
                                  models: [ todoModel ],
                                  docker: true,
                                  bluemix: {
                                    backendPlatform: 'SWIFT',
                                    server: {
                                      domain: 'mydomain.net',
                                      cloudDeploymentType: 'Kube',
                                      cloudDeploymentOptions: {
                                        kubeClusterName: 'devex-default',
                                        kubeClusterNamespace: 'myClusterNamespace',
                                        imageRegistryNamespace: 'mynamespace'
                                      }
                                    }
                                  }
                                }
                              })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        it('created ibmcloud dev config file', function () {
          assert.file(bxdevConfigFile)
        })

        commonTest.itCreatedDockerFilesWithExpectedContent(applicationName)

        // NOTE(tunniclm): For now we have overloaded the docker
        // option to produce kubernetes files as well
        commonTest.itCreatedKubernetesFilesWithExpectedContent({
          applicationName: applicationName,
          domain: 'mydomain.net',
          imageRegistryNamespace: 'mynamespace'
        })

        commonTest.itCreatedKubernetesPipelineFilesWithExpectedContent({
          clusterName: 'devex-default',
          clusterNamespace: 'myClusterNamespace'
        })
      })

      describe('with VSI', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
                              .withOptions({
                                specObj: {
                                  appType: 'crud',
                                  appName: applicationName,
                                  models: [ todoModel ],
                                  docker: true,
                                  bluemix: {
                                    backendPlatform: 'SWIFT',
                                    server: {
                                      domain: 'mydomain.net',
                                      cloudDeploymentType: 'VSI'
                                    }
                                  }
                                }
                              })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itCreatedVSIFilesWithExpectedContent({
          applicationName: applicationName
        })
      })

      describe('with CF', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
                              .withOptions({
                                deploymentRegion: deploymentRegion,
                                deploymentOrg: deploymentOrg,
                                deploymentSpace: deploymentSpace,
                                toolchainName: toolchainName,
                                specObj: {
                                  appType: 'crud',
                                  appName: applicationName,
                                  models: [ todoModel ],
                                  docker: true,
                                  bluemix: {
                                    backendPlatform: 'SWIFT',
                                    server: {
                                      domain: 'mydomain.net',
                                      cloudDeploymentType: 'CF'
                                    }
                                  }
                                }
                              })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itCreatedCFPipelineFilesWithExpectedContent()
      })

      describe('with apic', function () {
        var runContext
        var apicProductFile = `definitions/${applicationName}-product.yaml`

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'crud',
                appName: applicationName,
                models: [ todoModel ]
              },
              apic: true
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        it('created a product file', function () {
          assert.file(apicProductFile)
        })

        it('product file contains expected content', function () {
          assert.fileContent([
            [ apicProductFile, `name: ${applicationName}` ],
            [ apicProductFile, `title: ${applicationName}` ]
          ])
        })

        it('swagger definition contains expected apic extension content', function () {
          assert.fileContent([
            [ swaggerFile, `name: ${applicationName}` ]
          ])
        })
      })

      describe('with metrics', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'crud',
                appName: applicationName,
                models: [ todoModel ],
                metrics: true
              }
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itHasPackageDependencies([ 'SwiftMetrics' ])
        commonTest.itCreatedMetricsFilesWithExpectedContent()
      })

      describe('with autoscaling (implies metrics)', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'crud',
                appName: applicationName,
                models: [ todoModel ],
                bluemix: {
                  backendPlatform: 'SWIFT',
                  server: { services: ['myAutoscalingService'] },
                  autoscaling: { serviceInfo: { name: 'myAutoscalingService' } }
                }
              }
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itCreatedMetricsFilesWithExpectedContent()

        commonTest.autoscaling.itCreatedServiceFilesWithExpectedContent('myAutoscalingService')
      })

      describe('with cloudant', function () {
        var runContext

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'crud',
                appName: applicationName,
                models: [ todoModel ],
                bluemix: {
                  backendPlatform: 'SWIFT',
                  server: { services: ['myCloudantService'] },
                  cloudant: [{ serviceInfo: { name: 'myCloudantService' } }]
                },
                crudservice: 'myCloudantService'
              }
            })
          return runContext.toPromise()
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        commonTest.itCreatedServiceConfigFiles()

        commonTest.cloudant.itCreatedServiceFilesWithExpectedContent('myCloudantService')

        it('created cloudant adapter', function () {
          assert.file(`${generatedSourceDir}/${todoModel.classname}CloudantAdapter.swift`)
        })
        it('has correct content in CloudantAdapter.swift', function () {
          assert.fileContent(`${generatedSourceDir}/${todoModel.classname}CloudantAdapter.swift`, 'Todo')
        })
        it('adapter factory uses cloudant adapter', function () {
          assert.fileContent(`${generatedSourceDir}/AdapterFactory.swift`, `${todoModel.classname}CloudantAdapter(`)
        })
      })
    })
  })

  describe('scaffold', function () {
    var applicationName = 'myapp'
    var executableModule = applicationName

    describe('base', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itUsedDefaultDestinationDirectory()

      commonTest.itCreatedCommonFiles(executableModule)
      commonTest.itHasCorrectFilesForSingleShotFalse()

      commonTest.itHasPackageDependencies([
        'Kitura',
        'HeliumLogger',
        'CloudEnvironment',
        'Health'
      ])

      commonTest.itCreatedRoutes([
        'Health'
      ])

      commonTest.itDidNotCreateRoutes([
        'Swagger'
      ])

      commonTest.itDidNotCreateServiceFiles()
      commonTest.itDidNotCreateMetricsFiles()
      commonTest.itDidNotCreateWebFiles()
      commonTest.itDidNotCreateSwaggerUIFiles()

      it('created cloudfoundry files', function () {
        assert.file(cloudFoundryFiles)
      })

      it(`README has correct content`, function () {
        assert.fileContent(`README.md`, 'Scaffolded Swift Kitura server application')
      })

      it('created bluemix files', function () {
        assert.file(bluemixFiles)
      })

      it('cloudfoundry manifest contains the expected content', function () {
        assert.fileContent([
          [ cloudFoundryManifestFile, `name: ${applicationName}` ],
          [ cloudFoundryManifestFile, 'random-route: true' ],
          [ cloudFoundryManifestFile, 'instances: 1' ],
          [ cloudFoundryManifestFile, 'memory: 128M' ],
          [ cloudFoundryManifestFile, 'timeout: 180' ]
        ])
        assert.noFileContent([
          [ cloudFoundryManifestFile, 'domain:' ],
          [ cloudFoundryManifestFile, 'host:' ],
          [ cloudFoundryManifestFile, 'namespace:' ],
          [ cloudFoundryManifestFile, 'OPENAPI_SPEC :' ]
        ])
      })

      /* it('cloudfoundry manifest defines health check details', function () {
        assert.fileContent([
          [ cloudFoundryManifestFile, 'health-check-type: http' ],
          [ cloudFoundryManifestFile, 'health-check-http-endpoint: /health' ]
        ])
      }) */

      it('cloudfoundry manifest does not define OPENAPI_SPEC', function () {
        assert.noFileContent(cloudFoundryManifestFile, 'OPENAPI_SPEC')
      })
    })

    describe('with single shot option', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName
            },
            'single-shot': true
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itUsedDefaultDestinationDirectory()

      commonTest.itCreatedCommonFiles(executableModule)
      commonTest.itHasCorrectFilesForSingleShotTrue()
    })

    describe('with custom bluemix options', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: {
                  name: applicationName,
                  host: 'myhost',
                  domain: 'mydomain.net',
                  disk_quota: '1024M'
                }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('cloudfoundry manifest contains the custom options', function () {
        assert.fileContent([
          [ cloudFoundryManifestFile, `name: ${applicationName}` ],
          [ cloudFoundryManifestFile, 'host: myhost' ],
          [ cloudFoundryManifestFile, 'domain: mydomain.net' ],
          [ cloudFoundryManifestFile, 'disk_quota: 1024M' ]
        ])
        assert.noFileContent([
          [ cloudFoundryManifestFile, 'random-route: true' ]
        ])
      })
    })

    describe('with unsupported service payloads in custom bluemix option', function () {
      var runContext

      // bluemix.json file from scaffolder w/ all services
      var bluemixJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources/unsupported_bluemix.json'), 'utf8'))

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: bluemixJSON
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      // created service config files
      commonTest.itCreatedServiceConfigFiles()

      // all unsupported services
      var unsupportedServices = ['accernApi', 'analytics', 'apacheSpark', 'appLaunch', 'blockchain', 'dashDb', 'discovery', 'documentConversion', 'historicalInstrumentAnalysis', 'instrumentAnalysis', 'investmentPortfolio', 'languageTranslator', 'messageHub', 'naturalLanguageClassifier', 'naturalLanguageUnderstanding', 'payeezy', 'personalityInsights', 'plaid', 'predictiveMarketScenarios', 'quovo', 'retrieveAndRank', 'simulatedHistoricalInstrumentAnalysis', 'simulatedInstrumentAnalysis', 'speechToText', 'textToSpeech', 'toneAnalyzer', 'visualRecognition', 'weatherInsights', 'xigniteMarketData']

      unsupportedServices.forEach(service => {
        commonTest.itDidNotCreateService(service)
      })
    })

    describe('with usecase enablement', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .inTmpDir(function (tmpDir) {
            // Create dummy starterkit project
            const pathToCreate = 'src/swift-kitura/Sources/Application/Routes'

            mkdirp.sync(pathToCreate)

            var starterSwiftAppRoutesFile = path.join(tmpDir, 'src', 'swift-kitura', 'Sources', 'Application', 'Routes', 'AppRoutes.swift')
            var starterPackageSwiftFile = path.join(tmpDir, 'src', 'swift-kitura', 'Package.swift.partial')

            fs.writeFileSync(starterSwiftAppRoutesFile, '')
            fs.writeFileSync(starterPackageSwiftFile, '')

            this.inDir(path.join(tmpDir, 'build'))
          })
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: {
                  name: applicationName,
                  host: 'myhost',
                  domain: 'mydomain.net',
                  disk_quota: '1024M'
                }
              },
              usecase: true
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      it('does initialize file serving middleware', function () {
        assert.fileContent(applicationSourceFile, 'router.all(middleware: StaticFileServer())')
      })

      it('does copy public folder', function () {
        assert.file(commonTest.webDir)
      })

      it('does initialize AppRoutes', function () {
        assert.fileContent(applicationSourceFile, 'initializeAppRoutes(app: self)')
      })

      it('does create AppRoutes.swift route file', function () {
        commonTest.itCreatedRoutes('AppRoutes')
      })

      it('does initialize ErrorRoutes', function () {
        assert.fileContent(applicationSourceFile, 'initializeErrorRoutes(app: self)')
      })

      it('does create ErrorRoutes.swift route file', function () {
        commonTest.itCreatedRoutes('ErrorRoutes')
      })
    })

    describe('with docker', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              docker: true,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: {
                  domain: 'mydomain.net'
                }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        nock.cleanAll()
        runContext.cleanTestDirectory()
      })

      it('created ibmcloud dev config file', function () {
        assert.file(bxdevConfigFile)
      })

      commonTest.itCreatedDockerFilesWithExpectedContent(applicationName)

      // NOTE(tunniclm): For now we have overloaded the docker
      // option to produce kubernetes files as well
      commonTest.itCreatedKubernetesFilesWithExpectedContent({
        applicationName: applicationName,
        domain: 'mydomain.net'
      })
    })

    describe('with metrics', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              metrics: true
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itHasPackageDependencies([ 'SwiftMetrics' ])
      commonTest.itCreatedMetricsFilesWithExpectedContent()
    })

    describe('with web', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              web: true
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedWebFiles()
    })

    describe('from swagger', function () {
      var outputSwaggerFile = `definitions/${applicationName}.yaml`

      describe('from http url', function () {
        describe('using dinosaur swagger (json, with basepath)', function () {
          var inputSwaggerFile = path.join(__dirname, '../resources/person_dino.json')
          var runContext
          var swaggerScope

          before(function () {
            swaggerScope = nock('http://dino.io')
              .get('/stuff')
              .replyWithFile(200, inputSwaggerFile)

            runContext = helpers.run(refreshGeneratorPath)
              .withOptions({
                specObj: {
                  appType: 'scaffold',
                  appName: applicationName,
                  fromSwagger: 'http://dino.io/stuff'
                }
              })
            return runContext.toPromise()
          })

          after(function () {
            nock.cleanAll()
            runContext.cleanTestDirectory()
          })

          commonTest.itCreatedRoutes([
            'Dinosaurs_',
            'Persons_'
          ])

          it('requested swagger over http', function () {
            assert(swaggerScope.isDone())
          })

          it('created a swagger definition file', function () {
            assert.file(outputSwaggerFile)
          })

          it('application defines base path', function () {
            assert.fileContent(applicationSourceFile, 'basePath = "/basepath"')
          })

          it('swagger routes prepend base path', function () {
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'app.router.get("\\(basePath)/dinosaurs"')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.get("\\(basePath)/persons"')
          })
        })
      })

      describe('embedded in spec (raw string)', function () {
        var inputSwaggerFile = path.join(__dirname, '../resources/person_dino.json')
        var swagger = JSON.parse(fs.readFileSync(inputSwaggerFile, 'utf8'))

        describe('using dinosaur swagger (json, with basepath)', function () {
          var runContext

          before(function () {
            runContext = helpers.run(refreshGeneratorPath)
              .withOptions({
                specObj: {
                  appType: 'scaffold',
                  appName: applicationName,
                  bluemix: {
                    backendPlatform: 'SWIFT',
                    openApiServers: [{ spec: JSON.stringify(swagger) }]
                  }
                }
              })
            return runContext.toPromise()
          })

          after(function () {
            nock.cleanAll()
            runContext.cleanTestDirectory()
          })

          commonTest.itCreatedRoutes([
            'Dinosaurs_',
            'Persons_'
          ])

          it('created a swagger definition file', function () {
            assert.file(outputSwaggerFile)
          })

          it('application defines base path', function () {
            assert.fileContent(applicationSourceFile, 'basePath = "/basepath"')
          })

          it('swagger routes prepend base path', function () {
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'app.router.get("\\(basePath)/dinosaurs"')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.get("\\(basePath)/persons"')
          })
        })
      })

      describe('generation of codable', function () {
        var inputSwaggerFile = path.join(__dirname, '../resources/person_dino.json')

        describe('gen person_dino as codable routes', function () {
          var runContext

          before(function () {
            runContext = helpers.run(refreshGeneratorPath)
              .withOptions({
                specObj: {
                  appType: 'scaffold',
                  appName: applicationName,
                  hostSwagger: true,
                  fromSwagger: inputSwaggerFile,
                  generateCodableRoutes: true
                }
              })
            return runContext.toPromise()
          })

          after(function () {
            nock.cleanAll()
            runContext.cleanTestDirectory()
          })

          commonTest.itUsedDefaultDestinationDirectory()
          commonTest.itCreatedCommonFiles(executableModule)

          commonTest.itCreatedRoutes([
            'Dinosaurs_',
            'Persons_',
            'Swagger'
          ])

          commonTest.itCreatedModels([
            'Dino',
            'Age',
            'Newage'
          ])

          it('application defines base path', function () {
            assert.fileContent(applicationSourceFile, 'basePath = "/basepath"')
          })
          it('swagger id has correct type', function () {
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'func getOne__persons__handler(id: String')
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'func getOne__dinosaurs__handler(id: Int')
          })

          it('swagger routes build correct route and handle registration', function () {
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'app.router.get("\\(basePath)/dinosaurs", handler: getAll__dinosaurs_handler')
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'func getAll__dinosaurs_handler(completion: ([dino]?, RequestError?) -> Void ) -> Void {')
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'completion(nil, .notImplemented)')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.get("\\(basePath)/persons", handler: getAll__persons_handler')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'func getAll__persons_handler(completion: ([age]?, RequestError?) -> Void ) -> Void {')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'completion(nil, .notImplemented)')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.post("\\(basePath)/persons", handler: post__persons_handler')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'func post__persons_handler(post: age, completion: (age?, RequestError?) -> Void ) -> Void {')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.get("\\(basePath)/persons/", handler: getOne__persons__handler')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'func getOne__persons__handler(id: String, completion: (age?, RequestError?) -> Void ) -> Void {')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.put("\\(basePath)/persons") { request, response, next in')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.post("\\(basePath)/persons/:id") { request, response, next in')
          })
        })
      })

      describe('generation of raw', function () {
        var inputSwaggerFile = path.join(__dirname, '../resources/person_dino.json')

        describe('gen person_dino as raw routes', function () {
          var runContext

          before(function () {
            runContext = helpers.run(refreshGeneratorPath)
              .withOptions({
                specObj: {
                  appType: 'scaffold',
                  appName: applicationName,
                  hostSwagger: true,
                  fromSwagger: inputSwaggerFile,
                  generateCodableRoutes: false
                }
              })
            return runContext.toPromise()
          })

          after(function () {
            nock.cleanAll()
            runContext.cleanTestDirectory()
          })

          commonTest.itUsedDefaultDestinationDirectory()
          commonTest.itCreatedCommonFiles(executableModule)

          commonTest.itCreatedRoutes([
            'Dinosaurs_',
            'Persons_',
            'Swagger'
          ])

          commonTest.itCreatedModels([
            'Dino',
            'Age',
            'Newage'
          ])

          it('application defines base path', function () {
            assert.fileContent(applicationSourceFile, 'basePath = "/basepath"')
          })

          it('swagger routes prepend base path', function () {
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'app.router.get("\\(basePath)/dinosaurs") { request, response, next in')
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'response.send(json: [:])')
            assert.fileContent(`${routesSourceDir}/Dinosaurs_Routes.swift`, 'next()')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.get("\\(basePath)/persons") { request, response, next in')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'response.send(json: [:])')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'next()')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.post("\\(basePath)/persons") { request, response, next in')
            assert.fileContent(`${routesSourceDir}/Persons_Routes.swift`, 'app.router.get("\\(basePath)/persons/") { request, response, next in')
          })
        })
      })

      describe('from invalid local file', function () {
        var inputSwaggerFile = path.join(__dirname, '../resources/invalid_swagger.json')

        var runContext
        var error

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'scaffold',
                appName: applicationName,
                fromSwagger: inputSwaggerFile
              }
            })
          return runContext.toPromise().catch(function (err) {
            error = err.message
          })
        })

        after(function () {
          runContext.cleanTestDirectory()
        })

        it('aborted the generator with an error', function () {
          assert(error, 'Should throw an error')
          assert(error.match('does not conform to swagger specification'), 'Thrown error should be about invalid swagger, it was: ' + error)
        })
      })

      describe('from non-existent local file', function () {
        var runContext
        var error

        before(function () {
          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'scaffold',
                appName: applicationName,
                fromSwagger: 'unknown_file_!£123'
              }
            })
          return runContext.toPromise().catch(function (err) {
            error = err.message
          })
        })

        after(function () {
          runContext.cleanTestDirectory()
        })

        it('aborted the generator with an error', function () {
          assert(error, 'Should throw an error')
          assert(error.match('unknown_file_!£123 doesn\'t exist'), 'Thrown error should be about invalid filename, it was: ' + error)
        })
      })

      describe('from non-existent path in url', function () {
        var runContext
        var sdkScope
        var error

        before(function () {
          // Simulate a 404 error
          sdkScope = nock('http://nothing')
            .get('/here')
            .reply(404)

          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'scaffold',
                appName: applicationName,
                fromSwagger: 'http://nothing/here'
              }
            })
          return runContext.toPromise().catch(function (err) {
            error = err.message
          })
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        it('requested server sdk over http', function () {
          assert(sdkScope.isDone())
        })

        it('aborted the generator with an error', function () {
          assert(error, 'Should throw an error')
          assert(error.match('failed to load swagger from: http://nothing/here status: 404'), 'Thrown error should be about 404 error, it was: ' + error)
        })
      })

      describe('from non-existent host in url', function () {
        var runContext
        var sdkScope
        var error

        before(function () {
          // Simulate a DNS lookup failure
          sdkScope = nock('http://nothing')
            .get('/here')
            .replyWithError({
              'message': 'getaddrinfo ENOTFOUND nothing nothing:80',
              'code': 'ENOTFOUND'
            })

          runContext = helpers.run(refreshGeneratorPath)
            .withOptions({
              specObj: {
                appType: 'scaffold',
                appName: applicationName,
                fromSwagger: 'http://nothing/here'
              }
            })
          return runContext.toPromise().catch(function (err) {
            error = err.message
          })
        })

        after(function () {
          nock.cleanAll()
          runContext.cleanTestDirectory()
        })

        it('requested server sdk over http', function () {
          assert(sdkScope.isDone())
        })

        it('aborted the generator with an error', function () {
          assert(error, 'Should throw an error')
          assert(error.match(/ENOTFOUND.*nothing:80/), 'Thrown error should be about failure to resolve host in URL, it was: ' + error)
        })
      })
    })

    describe('with a service whose name contains a space', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['name with spaces'] },
                cloudant: [{ serviceInfo: { name: 'name with spaces' } }]
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.cloudant.itCreatedServiceFilesWithExpectedContent('name with spaces')
    })

    describe('with cloudant', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myCloudantService'] },
                cloudant: [{ serviceInfo: { name: 'myCloudantService' } }]
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.cloudant.itCreatedServiceFilesWithExpectedContent('myCloudantService')
    })

    describe('with autoscaling (implies metrics)', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myAutoscalingService'] },
                autoscaling: { serviceInfo: { name: 'myAutoscalingService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedMetricsFilesWithExpectedContent()
      commonTest.autoscaling.itCreatedServiceFilesWithExpectedContent('myAutoscalingService')
    })

    describe('with appid', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myAppidService'] },
                appid: { serviceInfo: { name: 'myAppidService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.appid.itCreatedServiceFilesWithExpectedContent('myAppidService')
    })

    describe('with watson assistant', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myAssistantService'] },
                conversation: { serviceInfo: { name: 'myAssistantService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.watsonassistant.itCreatedServiceFilesWithExpectedContent('myAssistantService')
    })

    describe('with push notificiations', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myPushService'] },
                push: { serviceInfo: { name: 'myPushService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.pushnotifications.itCreatedServiceFilesWithExpectedContent('myPushService')
    })

    describe('with alert notification', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myAlertService'] },
                alertNotification: { serviceInfo: { name: 'myAlertService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.alertnotification.itCreatedServiceFilesWithExpectedContent('myAlertService')
    })

    describe('with redis', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: ['myRedisService'] },
                redis: { serviceInfo: { name: 'myRedisService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.redis.itCreatedServiceFilesWithExpectedContent('myRedisService')
    })

    describe('with mongodb', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: [ 'myMongoDBService' ] },
                mongodb: { serviceInfo: { name: 'myMongoDBService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.mongodb.itCreatedServiceFilesWithExpectedContent('myMongoDBService')
    })

    describe('with hypersecuredb', function () {
      var runContext

      before(function () {
        runContext = helpers.run(refreshGeneratorPath)
          .withOptions({
            specObj: {
              appType: 'scaffold',
              appName: applicationName,
              bluemix: {
                backendPlatform: 'SWIFT',
                server: { services: [ 'myHypersecuredbService' ] },
                hypersecuredb: { serviceInfo: { name: 'myHypersecuredbService' } }
              }
            }
          })
        return runContext.toPromise()
      })

      after(function () {
        runContext.cleanTestDirectory()
      })

      commonTest.itCreatedServiceConfigFiles()
      commonTest.hypersecuredb.itCreatedServiceFilesWithExpectedContent('myHypersecuredbService')
    })
  })
})
