EditorUi.prototype.importFiles = function(files, x, y, maxSize, fn, resultFn, filterFn, barrierFn, resizeDialog, maxBytes, resampleThreshold, ignoreEmbeddedXml)
	{
		x = (x != null) ? x : 0;
		y = (y != null) ? y : 0;
		maxSize = (maxSize != null) ? maxSize : this.maxImageSize;
		maxBytes = (maxBytes != null) ? maxBytes : this.maxImageBytes;
		
		var crop = x != null && y != null;
		var resizeImages = true;
		
		// Checks if large images are imported
		var largeImages = false;
		
		if (!mxClient.IS_CHROMEAPP && files != null)
		{
			var thresh = resampleThreshold || this.resampleThreshold;
			
			for (var i = 0; i < files.length; i++)
			{
				if (files[i].type.substring(0, 6) == 'image/' && files[i].size > thresh)
				{
					largeImages = true;
					
					break;
				}
			}
		}

		var doImportFiles = mxUtils.bind(this, function()
		{
			var graph = this.editor.graph;
			var gs = graph.gridSize;
	
			fn = (fn != null) ? fn : mxUtils.bind(this, function(data, mimeType, x, y, w, h, filename, done, file)
			{
				if (data != null && data.substring(0, 10) == '<mxlibrary')
				{
					this.spinner.stop();
					this.loadLibrary(new LocalLibrary(this, data, filename));
	    			
	    			return null;
				}
				else
				{
					return this.importFile(data, mimeType, x, y, w, h, filename, done, file, crop, ignoreEmbeddedXml);
				}
			});
			
			resultFn = (resultFn != null) ? resultFn : mxUtils.bind(this, function(cells)
			{
				graph.setSelectionCells(cells);
			});
			
			if (this.spinner.spin(document.body, mxResources.get('loading')))
			{
				var count = files.length;
				var remain = count;
				var queue = [];
				
				// Barrier waits for all files to be loaded asynchronously
				var barrier = mxUtils.bind(this, function(index, fnc)
				{
					queue[index] = fnc;
					
					if (--remain == 0)
					{
						this.spinner.stop();
						
						if (barrierFn != null)
						{
							barrierFn(queue);
						}
						else
						{
							var cells = [];
							
							graph.getModel().beginUpdate();
							try
							{
						    	for (var j = 0; j < queue.length; j++)
						    	{
						    		var tmp = queue[j]();
						    		
						    		if (tmp != null)
						    		{
						    			cells = cells.concat(tmp);
						    		}
						    	}
							}
							finally
							{
								graph.getModel().endUpdate();
							}
						}
						
						resultFn(cells);
					}
				});
				
				for (var i = 0; i < count; i++)
				{
					(mxUtils.bind(this, function(index)
					{
						var file = files[index];
						
						if (file != null)
						{
							var reader = new FileReader();
							
							reader.onload = mxUtils.bind(this, function(e)
							{
								if (filterFn == null || filterFn(file))
								{
						    		if (file.type.substring(0, 6) == 'image/')
						    		{
						    			if (file.type.substring(0, 9) == 'image/svg')
						    			{
						    				// Checks if SVG contains content attribute
					    					var data = e.target.result;
					    					var comma = data.indexOf(',');
					    					var svgText = decodeURIComponent(escape(atob(data.substring(comma + 1))));
					    					var root = mxUtils.parseXml(svgText);
				    						var svgs = root.getElementsByTagName('svg');
				    						
				    						if (svgs.length > 0)
					    					{
				    							var svgRoot = svgs[0];
						    					var cont = (ignoreEmbeddedXml) ? null : svgRoot.getAttribute('content');
		
						    					if (cont != null && cont.charAt(0) != '<' && cont.charAt(0) != '%')
						    					{
						    						cont = unescape((window.atob) ? atob(cont) : Base64.decode(cont, true));
						    					}
						    					
						    					if (cont != null && cont.charAt(0) == '%')
						    					{
						    						cont = decodeURIComponent(cont);
						    					}
		
						    					if (cont != null && (cont.substring(0, 8) === '<mxfile ' ||
						    						cont.substring(0, 14) === '<mxGraphModel '))
						    					{
						    						barrier(index, mxUtils.bind(this, function()
								    				{
								    					return fn(cont, 'text/xml', x + index * gs, y + index * gs, 0, 0, file.name);	
								    				}));
						    					}
						    					else
						    					{
								    				// SVG needs special handling to add viewbox if missing and
								    				// find initial size from SVG attributes (only for IE11)
								    				barrier(index, mxUtils.bind(this, function()
								    				{
							    						try
							    						{
									    					var prefix = data.substring(0, comma + 1);
									    					
									    					// Parses SVG and find width and height
									    					if (root != null)
									    					{
									    						var svgs = root.getElementsByTagName('svg');
									    						
									    						if (svgs.length > 0)
										    					{
									    							var svgRoot = svgs[0];
										    						var w = svgRoot.getAttribute('width');
										    						var h = svgRoot.getAttribute('height');
										    						
										    						if (w != null && w.charAt(w.length - 1) != '%')
									    							{
									    								w = parseFloat(w);
									    							}
									    							else
									    							{
									    								w = NaN;
									    							}
										    						
										    						if (h != null && h.charAt(h.length - 1) != '%')
									    							{
									    								h = parseFloat(h);
									    							}
									    							else
									    							{
									    								h = NaN;
									    							}
										    						
										    						// Check if viewBox attribute already exists
										    						var vb = svgRoot.getAttribute('viewBox');
										    						
										    						if (vb == null || vb.length == 0)
										    						{
										    							svgRoot.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
										    						}
										    						// Uses width and height from viewbox for
										    						// missing width and height attributes
										    						else if (isNaN(w) || isNaN(h))
										    						{
										    							var tokens = vb.split(' ');
										    							
										    							if (tokens.length > 3)
										    							{
										    								w = parseFloat(tokens[2]);
										    								h = parseFloat(tokens[3]);
										    							}
										    						}
	
										    						data = this.createSvgDataUri(mxUtils.getXml(svgRoot));
										    						var s = Math.min(1, Math.min(maxSize / Math.max(1, w)), maxSize / Math.max(1, h));
										    						var cells = fn(data, file.type, x + index * gs, y + index * gs, Math.max(
										    							1, Math.round(w * s)), Math.max(1, Math.round(h * s)), file.name);
										    						
										    						// Hack to fix width and height asynchronously
										    						if (isNaN(w) || isNaN(h))
										    						{
										    							var img = new Image();
										    							
										    							img.onload = mxUtils.bind(this, function()
										    							{
										    								w = Math.max(1, img.width);
										    								h = Math.max(1, img.height);
										    								
										    								cells[0].geometry.width = w;
										    								cells[0].geometry.height = h;
										    								
										    								svgRoot.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
										    								data = this.createSvgDataUri(mxUtils.getXml(svgRoot));
										    								
										    								var semi = data.indexOf(';');
										    								
										    								if (semi > 0)
										    								{
										    									data = data.substring(0, semi) + data.substring(data.indexOf(',', semi + 1));
										    								}
										    								
										    								graph.setCellStyles('image', data, [cells[0]]);
										    							});
										    							
										    							img.src = this.createSvgDataUri(mxUtils.getXml(svgRoot));
										    						}
										    						
										    						return cells;
										    					}
									    					}
							    						}
							    						catch (e)
							    						{
							    							// ignores any SVG parsing errors
							    						}
								    					
								    					return null;
								    				}));
						    					}
					    					}
				    						else
				    						{
					    						barrier(index, mxUtils.bind(this, function()
							    				{
							    					return null;
							    				}));
				    						}
						    			}
						    			else
						    			{
						    				// Checks if PNG+XML is available to bypass code below
						    				var containsModel = false;
						    				
						    				if (file.type == 'image/png')
						    				{
						    					var xml = (ignoreEmbeddedXml) ? null : this.extractGraphModelFromPng(e.target.result);
						    					
						    					if (xml != null && xml.length > 0)
						    					{
						    						var img = new Image();
						    						img.src = e.target.result;
						    						
								    				barrier(index, mxUtils.bind(this, function()
								    				{
								    					return fn(xml, 'text/xml', x + index * gs, y + index * gs,
								    						img.width, img.height, file.name);	
								    				}));
						    						
						    						containsModel = true;
						    					}
						    				}
						    				
							    			// Additional asynchronous step for finding image size
						    				if (!containsModel)
						    				{
						    					// Cannot load local files in Chrome App
						    					if (mxClient.IS_CHROMEAPP)
						    					{
						    						this.spinner.stop();
						    						this.showError(mxResources.get('error'), mxResources.get('dragAndDropNotSupported'),
						    							mxResources.get('cancel'), mxUtils.bind(this, function()
					    								{
					    									// Hides the dialog
					    								}), null, mxResources.get('ok'), mxUtils.bind(this, function()
					    								{
						    								// Redirects to import function
					    									this.actions.get('import').funct();
					    								})
					    							);
						    					}
						    					else
						    					{
									    			this.loadImage(e.target.result, mxUtils.bind(this, function(img)
									    			{
									    				this.resizeImage(img, e.target.result, mxUtils.bind(this, function(data2, w2, h2)
									    				{
										    				barrier(index, mxUtils.bind(this, function()
												    		{
										    					// Refuses to insert images above a certain size as they kill the app
										    					if (data2 != null && data2.length < maxBytes)
										    					{
											    					var s = (!resizeImages || !this.isResampleImage(e.target.result, resampleThreshold)) ? 1 : Math.min(1, Math.min(maxSize / w2, maxSize / h2));
												    				
											    					return fn(data2, file.type, x + index * gs, y + index * gs, Math.round(w2 * s), Math.round(h2 * s), file.name);
										    					}
										    					else
										    					{
										    						this.handleError({message: mxResources.get('imageTooBig')});
										    						
										    						return null;
										    					}
												    		}));
									    				}), resizeImages, maxSize, resampleThreshold);
									    			}), mxUtils.bind(this, function()
									    			{
									    				this.handleError({message: mxResources.get('invalidOrMissingFile')});
									    			}));
						    					}
						    				}
						    			}
						    		}
						    		else
						    		{
										fn(e.target.result, file.type, x + index * gs, y + index * gs, 240, 160, file.name, function(cells)
										{
											barrier(index, function()
				    	    				{
				    		    				return cells;
				    	    				});
										}, file);
						    		}
								}
							});
							
							// Handles special cases
							if (/(\.v(dx|sdx?))($|\?)/i.test(file.name) || /(\.vs(x|sx?))($|\?)/i.test(file.name))
							{
								fn(null, file.type, x + index * gs, y + index * gs, 240, 160, file.name, function(cells)
								{
									barrier(index, function()
		    	    				{
		    		    				return cells;
		    	    				});
								}, file);
							}
							else if (file.type.substring(0, 5) == 'image')
							{
								reader.readAsDataURL(file);
							}
							else
							{
								reader.readAsText(file);
							}
						}
					}))(i);
				}
			}
		});
		
		if (largeImages)
		{
			// Workaround for lost files array in async code
			var tmp = [];
			
			for (var i = 0; i < files.length; i++)
			{
				tmp.push(files[i]);
			}
			
			files = tmp;
			
			this.confirmImageResize(function(doResize)
			{
				resizeImages = doResize;
				doImportFiles();
			}, resizeDialog);
		}
		else
		{
			doImportFiles();
		}
	};
